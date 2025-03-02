from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import json
import os
import uuid
import logging
import asyncio
from typing import List, Dict, Optional, Set

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
# Update to use host.docker.internal to access Windows host Ollama
OLLAMA_API_URL = os.environ.get("OLLAMA_API_URL", "http://host.docker.internal:11434/api")
CHARACTERS_DIR = os.environ.get("CHARACTERS_DIR", "./characters")
CONVERSATIONS_DIR = os.environ.get("CONVERSATIONS_DIR", "./conversations")
CONFIG_DIR = os.environ.get("CONFIG_DIR", "./config")
CONFIG_FILE = os.path.join(CONFIG_DIR, "system_config.json")

# Create directories if they don't exist
os.makedirs(CHARACTERS_DIR, exist_ok=True)
os.makedirs(CONVERSATIONS_DIR, exist_ok=True)
os.makedirs(CONFIG_DIR, exist_ok=True)

# Log the Ollama API URL at startup
logger.info(f"Using Ollama API URL: {OLLAMA_API_URL}")

# Track model loading status
model_loading_status = {}
model_loading_lock = asyncio.Lock()

# System configuration with defaults
DEFAULT_SYSTEM_CONFIG = {
    "active_model": "deepseek:7b",
    "temperature": 0.7,
    "max_tokens": 1024
}

# Models
class Character(BaseModel):
    name: str
    system_prompt: str
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
    system_prompt: str
    personality_traits: Optional[Dict[str, str]] = None

class SystemConfig(BaseModel):
    active_model: str
    temperature: float = 0.7
    max_tokens: int = 1024

class ModelLoadRequest(BaseModel):
    model_name: str

# Helper functions
def load_system_config() -> SystemConfig:
    """Load system configuration from file or create default if it doesn't exist"""
    if not os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "w") as f:
            json.dump(DEFAULT_SYSTEM_CONFIG, f, indent=2)
        return SystemConfig(**DEFAULT_SYSTEM_CONFIG)
    
    with open(CONFIG_FILE, "r") as f:
        return SystemConfig(**json.load(f))

def save_system_config(config: SystemConfig):
    """Save system configuration to file"""
    with open(CONFIG_FILE, "w") as f:
        json.dump(config.dict(), f, indent=2)

# API Endpoints
@app.get("/system/config", response_model=SystemConfig)
async def get_system_config():
    """Get system configuration"""
    try:
        return load_system_config()
    except Exception as e:
        logger.error(f"Error loading system config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/system/config", response_model=SystemConfig)
async def update_system_config(config: SystemConfig):
    """Update system configuration"""
    try:
        save_system_config(config)
        return config
    except Exception as e:
        logger.error(f"Error updating system config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/system/models", response_model=List[Dict])
async def list_available_models():
    """List all available models from Ollama"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{OLLAMA_API_URL}/tags")
            models = response.json().get("models", [])
            
            # Add loading status information
            for model in models:
                model_name = model.get("name")
                model["loading"] = model_loading_status.get(model_name, False)
                
            return models
    except Exception as e:
        logger.error(f"Error listing models: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/system/models/load", response_model=Dict)
async def load_model(request: ModelLoadRequest):
    """Initiate model loading"""
    model_name = request.model_name
    
    try:
        # Set loading status
        async with model_loading_lock:
            model_loading_status[model_name] = True
        
        # Start loading the model (non-blocking)
        asyncio.create_task(perform_model_loading(model_name))
        
        return {"status": "loading", "model": model_name}
    except Exception as e:
        logger.error(f"Error initiating model loading: {e}")
        # Reset loading status on error
        async with model_loading_lock:
            model_loading_status[model_name] = False
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/system/models/status", response_model=Dict[str, bool])
async def get_model_loading_status():
    """Get current model loading status"""
    return model_loading_status

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
        
        # Create character file (using only personality traits, no model information)
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

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check if we can connect to Ollama
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{OLLAMA_API_URL}/tags")
            if response.status_code != 200:
                return {"status": "unhealthy", "message": "Cannot connect to Ollama"}
            
            # Return available models
            models = response.json().get("models", [])
            model_names = [model.get("name") for model in models]
            
            return {
                "status": "healthy",
                "ollama_url": OLLAMA_API_URL,
                "available_models": model_names,
                "active_model": load_system_config().active_model
            }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {"status": "unhealthy", "message": str(e)}

async def perform_model_loading(model_name: str):
    """Actually perform the model loading in background"""
    try:
        logger.info(f"Starting to load model: {model_name}")
        
        # Use Ollama's generate endpoint with a minimal prompt to load the model
        async with httpx.AsyncClient(timeout=1800.0) as client:
            response = await client.post(
                f"{OLLAMA_API_URL}/generate",
                json={
                    "model": model_name,
                    "prompt": "Hello",
                    "temperature": 0.7,
                    "max_tokens": 10,
                    "stream": False
                }
            )
            
            if response.status_code != 200:
                logger.error(f"Error loading model {model_name}: {response.text}")
                raise Exception(f"Error loading model: {response.text}")
            
            logger.info(f"Successfully loaded model: {model_name}")
            
            # Update system config with new model
            config = load_system_config()
            config.active_model = model_name
            save_system_config(config)
            
            # Update loading status
            async with model_loading_lock:
                model_loading_status[model_name] = False
    except Exception as e:
        logger.error(f"Error loading model {model_name}: {e}")
        # Update loading status on error
        async with model_loading_lock:
            model_loading_status[model_name] = False

async def generate_response(conversation: Conversation, character_name: str) -> str:
    """Generate a response from a character"""
    try:
        # Load character
        character_path = os.path.join(CHARACTERS_DIR, f"{character_name}.json")
        with open(character_path, "r") as f:
            character = Character(**json.load(f))
        
        # Load system config for model, temperature and max_tokens
        system_config = load_system_config()
        
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
        logger.info(f"Prompt for {character_name} using model {system_config.active_model}:\n{prompt_text}")
        
        # Generate response using Ollama
        async with httpx.AsyncClient(timeout=1800.0) as client:
            response = await client.post(
                f"{OLLAMA_API_URL}/generate",
                json={
                    "model": system_config.active_model,
                    "prompt": prompt_text,
                    "temperature": system_config.temperature,
                    "max_tokens": system_config.max_tokens,
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
