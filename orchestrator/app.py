from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import json
import os
import uuid
import logging
from typing import List, Dict, Optional

app = FastAPI(title="LLM Conversation Orchestrator")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)

# Configuration
OLLAMA_API_URL = "http://llm-service:11434/api"
CHARACTERS_DIR = os.environ.get("CHARACTERS_DIR", "./characters")
CONVERSATIONS_DIR = os.environ.get("CONVERSATIONS_DIR", "./conversations")

# Create directories if they don't exist
os.makedirs(CHARACTERS_DIR, exist_ok=True)
os.makedirs(CONVERSATIONS_DIR, exist_ok=True)

# Models
class Character(BaseModel):
    name: str
    model: str
    system_prompt: str
    temperature: float = 0.7
    max_tokens: int = 1024
    personality_traits: Optional[Dict[str, str]] = None

class Message(BaseModel):
    role: str
    content: str

class Conversation(BaseModel):
    id: str
    characters: List[str]
    messages: List[Message] = []

class ConversationRequest(BaseModel):
    characters: List[str]
    initial_message: str
    num_turns: int = 5

class CharacterCreationRequest(BaseModel):
    name: str
    model: str
    system_prompt: str
    personality_traits: Optional[Dict[str, str]] = None
    temperature: float = 0.7
    max_tokens: int = 1024

# API Endpoints
@app.get("/characters", response_model=List[str])
async def list_characters():
    """List all available characters"""
    try:
        return [f.replace(".json", "") for f in os.listdir(CHARACTERS_DIR) if f.endswith(".json")]
    except Exception as e:
        logger.error(f"Error listing characters: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/characters", response_model=dict)
async def create_character(character: CharacterCreationRequest):
    """Create a new character"""
    try:
        # Check if character already exists
        character_path = os.path.join(CHARACTERS_DIR, f"{character.name}.json")
        if os.path.exists(character_path):
            raise HTTPException(status_code=400, detail=f"Character {character.name} already exists")
        
        # Check if model exists in Ollama
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(f"{OLLAMA_API_URL}/tags")
                models = response.json().get("models", [])
                available_models = [model.get("name") for model in models]
                
                if character.model not in available_models:
                    logger.warning(f"Model {character.model} not found in Ollama")
            except Exception as e:
                logger.warning(f"Could not verify model existence: {e}")
        
        # Create character file
        character_data = character.dict()
        with open(character_path, "w") as f:
            json.dump(character_data, f, indent=2)
        
        return {"status": "success", "message": f"Character {character.name} created"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating character: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/characters/{name}", response_model=Character)
async def get_character(name: str):
    """Get character details"""
    try:
        character_path = os.path.join(CHARACTERS_DIR, f"{name}.json")
        if not os.path.exists(character_path):
            raise HTTPException(status_code=404, detail=f"Character {name} not found")
        
        with open(character_path, "r") as f:
            return json.load(f)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting character: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/conversations", response_model=Conversation)
async def create_conversation(request: ConversationRequest):
    """Start a new conversation between characters"""
    try:
        # Check if all characters exist
        for character_name in request.characters:
            character_path = os.path.join(CHARACTERS_DIR, f"{character_name}.json")
            if not os.path.exists(character_path):
                raise HTTPException(status_code=404, detail=f"Character {character_name} not found")
        
        # Create conversation
        conversation_id = str(uuid.uuid4())
        conversation = Conversation(
            id=conversation_id,
            characters=request.characters,
            messages=[
                Message(role="system", content="A conversation is starting between the characters.")
            ]
        )
        
        # Add initial message from the first character
        conversation.messages.append(
            Message(role=request.characters[0], content=request.initial_message)
        )
        
        # Generate conversation turns
        current_character_index = 1  # Start with the second character
        for _ in range(request.num_turns):
            if current_character_index >= len(request.characters):
                current_character_index = 0
            
            current_character = request.characters[current_character_index]
            response_content = await generate_response(conversation, current_character)
            
            conversation.messages.append(
                Message(role=current_character, content=response_content)
            )
            
            current_character_index += 1
        
        # Save conversation
        conversation_path = os.path.join(CONVERSATIONS_DIR, f"{conversation_id}.json")
        with open(conversation_path, "w") as f:
            f.write(conversation.json())
        
        return conversation
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/conversations", response_model=List[str])
async def list_conversations():
    """List all conversations"""
    try:
        return [f.replace(".json", "") for f in os.listdir(CONVERSATIONS_DIR) if f.endswith(".json")]
    except Exception as e:
        logger.error(f"Error listing conversations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/conversations/{conversation_id}", response_model=Conversation)
async def get_conversation(conversation_id: str):
    """Get a specific conversation"""
    try:
        conversation_path = os.path.join(CONVERSATIONS_DIR, f"{conversation_id}.json")
        if not os.path.exists(conversation_path):
            raise HTTPException(status_code=404, detail=f"Conversation {conversation_id} not found")
        
        with open(conversation_path, "r") as f:
            return json.loads(f.read())
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/conversations/{conversation_id}/continue", response_model=Conversation)
async def continue_conversation(conversation_id: str, num_turns: int = Body(1, embed=True)):
    """Continue an existing conversation for additional turns"""
    try:
        conversation_path = os.path.join(CONVERSATIONS_DIR, f"{conversation_id}.json")
        if not os.path.exists(conversation_path):
            raise HTTPException(status_code=404, detail=f"Conversation {conversation_id} not found")
        
        # Load conversation
        with open(conversation_path, "r") as f:
            conversation = Conversation(**json.loads(f.read()))
        
        # Find last character index
        last_character = conversation.messages[-1].role
        if last_character == "system":
            current_character_index = 0
        else:
            current_character_index = conversation.characters.index(last_character)
            current_character_index = (current_character_index + 1) % len(conversation.characters)
        
        # Generate conversation turns
        for _ in range(num_turns):
            current_character = conversation.characters[current_character_index]
            response_content = await generate_response(conversation, current_character)
            
            conversation.messages.append(
                Message(role=current_character, content=response_content)
            )
            
            current_character_index = (current_character_index + 1) % len(conversation.characters)
        
        # Save updated conversation
        with open(conversation_path, "w") as f:
            f.write(conversation.json())
        
        return conversation
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error continuing conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def generate_response(conversation: Conversation, character_name: str) -> str:
    """Generate a response from a character"""
    try:
        # Load character
        character_path = os.path.join(CHARACTERS_DIR, f"{character_name}.json")
        with open(character_path, "r") as f:
            character = Character(**json.load(f))
        
        # Create prompt for the model
        other_characters = [c for c in conversation.characters if c != character_name]
        system_prompt = f"""
        あなたは{character.name}というキャラクターです。
        {character.system_prompt}
        
        あなたは{', '.join(other_characters)}との会話に参加しています。
        自然な会話の中で、あなたのキャラクターとして応答してください。
        
        重要なルール：
        1. 必ずあなたのキャラクターとして短い返答をしてください。
        2. <think>タグや思考プロセスは含めないでください。
        3. 引用符（"）は使わないでください。
        4. キャラクター名を返信の前に付けないでください。
        5. 他のキャラクターとの自然な会話をしましょう。
        6. 同じ話題が続いたときは自然に話題を変えましょう。誰かが話題を変えたら、それについて行きましょう。
        """
        
        # Build a cleaner conversation history with names to make it more clear
        prompt_text = f"# システム指示\n{system_prompt}\n\n# 会話履歴\n"
        
        # Add conversation history with clear naming
        # use only the last some messages
        for message in conversation.messages[-20:]:
            if message.role == "system":
                continue
            
            # Clean any thinking tags from previous messages
            content = message.content
            if "<think>" in content and "</think>" in content:
                # Remove anything between <think> and </think> tags
                parts = content.split("<think>")
                for i in range(1, len(parts)):
                    if "</think>" in parts[i]:
                        think_end = parts[i].find("</think>") + len("</think>")
                        parts[i] = parts[i][think_end:]
                content = "".join(parts)
            
            # Remove quotes from content
            if (content.startswith('"') and content.endswith('"')) or \
               (content.startswith("'") and content.endswith("'")):
                content = content[1:-1].strip()
            
            # Add to conversation history with character name
            prompt_text += f"{message.role}: {content.strip()}\n\n"
        
        # Add the current prompt for the character
        prompt_text += f"{character_name} (あなた): "
        
        # Log the processed prompt for debugging
        logger.info(f"Prompt for {character_name}:\n{prompt_text}")
        
        # Generate response using Ollama
        async with httpx.AsyncClient(timeout=1800.0) as client:
            response = await client.post(
                f"{OLLAMA_API_URL}/generate",
                json={
                    "model": character.model,
                    "prompt": prompt_text,
                    "temperature": character.temperature,
                    "max_tokens": character.max_tokens,
                    "stream": False
                }
            )
            
            if response.status_code != 200:
                logger.error(f"Error from Ollama: {response.text}")
                raise HTTPException(status_code=500, detail="Error generating response from model")
            
            response_text = response.json().get("response", "")
            
            # Clean up response
            response_text = response_text.strip()
            
            # Remove <think> tags and content between them if they appear
            if "<think>" in response_text and "</think>" in response_text:
                parts = response_text.split("<think>")
                result = [parts[0]]  # Keep text before first <think>
                for i in range(1, len(parts)):
                    if "</think>" in parts[i]:
                        think_end = parts[i].find("</think>") + len("</think>")
                        result.append(parts[i][think_end:])  # Add text after </think>
                    else:
                        # No matching </think>, just keep the original part
                        result.append(parts[i])
                response_text = "".join(result)
            
            # Remove character name if the model prefixed it
            for char_name in conversation.characters:
                if response_text.startswith(f"{char_name}:"):
                    response_text = response_text[len(char_name)+1:].strip()
            
            # Remove quotes if the model wrapped the response in quotes
            if (response_text.startswith('"') and response_text.endswith('"')) or \
               (response_text.startswith("'") and response_text.endswith("'")):
                response_text = response_text[1:-1].strip()
            
            # Log the final processed response
            logger.info(f"Response from {character_name} (raw): {response_text}")
            
            return response_text.strip()
    except Exception as e:
        logger.error(f"Error generating response: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
