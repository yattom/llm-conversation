# Multi-Agent LLM Conversation System

A Docker-based system for running conversations between multiple AI characters using smaller LLMs (like Llama or DeepSeek) locally on a Windows 11 PC with an RTX 3080.

## Overview

This system allows you to create multiple AI characters with distinct personalities and have them converse with each other. The output of one AI character becomes the input for another, creating a continuous conversation between several virtual people.

## Features

- Run smaller LLMs locally using Ollama
- Create custom AI characters with unique personalities
- Generate multi-turn conversations between AI characters
- Continue existing conversations
- Web UI for easy management
- Full GPU acceleration on RTX 3080
- Dockerized for simple deployment

## Requirements

- Windows 11 Home
- NVIDIA RTX 3080 GPU
- Docker Desktop with WSL 2 backend
- NVIDIA Container Toolkit installed

## Installation

### 1. Install Docker Desktop and NVIDIA Container Toolkit

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) for Windows.
2. Enable WSL 2 backend in Docker Desktop settings.
3. Install NVIDIA Container Toolkit within WSL 2:

```bash
# Inside WSL 2 terminal
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker
```

### 2. Clone this repository

```bash
git clone https://github.com/yourusername/multi-agent-llm-conversation.git
cd multi-agent-llm-conversation
```

### 3. Start the system

```bash
docker-compose up -d
```

The first time you run this, it will download the Ollama image and build the custom images for the conversation orchestrator and web UI.

### 4. Download LLM models in Ollama

```bash
# Example: Download Llama 3 8B model
docker exec -it ollama-service ollama pull llama3:8b

# Example: Download DeepSeek 7B model
docker exec -it ollama-service ollama pull deepseek:7b
```

## Usage

1. Access the web UI at http://localhost:3000
2. Create AI characters with unique personalities
3. Start a new conversation between characters
4. Continue the conversation for more turns

## Project Structure

```
.
├── docker-compose.yml       # Main Docker Compose configuration
├── ollama-data/             # Ollama model data (created on first run)
├── conversations/           # Stored conversations (created on first run)
├── characters/              # Character definitions (created on first run)
├── orchestrator/            # Conversation orchestrator service
│   ├── app.py               # FastAPI application
│   ├── Dockerfile           # Orchestrator container definition
│   └── requirements.txt     # Python dependencies
└── web-ui/                  # Web interface
    ├── src/                 # React source code
    │   ├── App.js           # Main application component
    │   └── ...
    ├── Dockerfile           # Web UI container definition
    ├── nginx.conf           # Nginx configuration
    └── package.json         # Node.js dependencies
```

## Creating Characters

Characters are defined with the following attributes:

- `name`: The character's name
- `model`: The Ollama model to use (e.g., llama3:8b, deepseek:7b)
- `system_prompt`: Instructions that define the character's personality and behavior
- `temperature`: Controls randomness in responses (0.0-2.0)
- `max_tokens`: Maximum response length

Check the `example-characters.md` file for sample character definitions.

## Advanced Configuration

### Using different LLM models

1. Download a model in Ollama:

```bash
docker exec -it ollama-service ollama pull model-name
```

2. When creating a character, specify the model name.

### Scaling for larger models

For larger models, you may need to adjust Docker resource allocations:

1. Open Docker Desktop settings
2. Go to Resources > Advanced
3. Increase memory and CPU allocations
4. Apply and restart Docker

## Troubleshooting

### GPU not detected in containers

- Ensure the NVIDIA Container Toolkit is properly installed
- Check that Docker Desktop is using the WSL 2 backend
- Verify your GPU drivers are up to date

### Slow model loading or generation

- Increase Docker memory allocation
- Try using a smaller model variant
- Adjust the `max_tokens` parameter for characters

## Limitations

- Performance depends on your GPU's VRAM and capabilities
- Larger models (>13B parameters) may be slow or unstable
- Long conversations might require additional memory

## License

This project is released under the MIT License.
