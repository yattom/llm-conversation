import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Box, 
  Typography, 
  Paper, 
  TextField, 
  Button, 
  List, 
  ListItem, 
  ListItemText,
  Divider, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Chip, 
  Grid, 
  CircularProgress,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  Switch,
  FormControlLabel,
  Slider,
  Tabs,
  Tab
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#3f51b5',
    },
    secondary: {
      main: '#f50057',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

const API_URL = 'http://localhost:8000';

function App() {
  // States
  const [characters, setCharacters] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [conversationDetails, setConversationDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [openCreateCharacter, setOpenCreateCharacter] = useState(false);
  const [openCreateConversation, setOpenCreateConversation] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(10);
  const autoRefreshTimerRef = React.useRef(null);
  const [availableModels, setAvailableModels] = useState([]);
  const [modelLoadingStatus, setModelLoadingStatus] = useState({});
  const [systemConfig, setSystemConfig] = useState({
    active_model: 'llama3:8b',
    temperature: 0.7,
    max_tokens: 1024
  });
  const [settingsTab, setSettingsTab] = useState(0);
  const [healthStatus, setHealthStatus] = useState({ status: 'unknown' });
  const [refreshingModels, setRefreshingModels] = useState(false);

  // New character form state
  const [newCharacter, setNewCharacter] = useState({
    name: '',
    system_prompt: '',
    personality_traits: {}
  });
  
  // New conversation form state
  const [newConversation, setNewConversation] = useState({
    characters: [],
    initial_message: '',
    num_turns: 5
  });

  // Initial data loading
  useEffect(() => {
    fetchCharacters();
    fetchConversations();
    fetchSystemConfig();
    fetchAvailableModels();
    checkHealth();
  }, []);

  // Load conversation details when selected
  useEffect(() => {
    if (selectedConversation) {
      fetchConversationDetails(selectedConversation);
    }
  }, [selectedConversation]);

  // Start polling for model loading status
  useEffect(() => {
    const pollModelLoadingStatus = () => {
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`${API_URL}/system/models/status`);
          if (response.ok) {
            const data = await response.json();
            setModelLoadingStatus(data);
            
            // If any model is loading, fetch available models to update UI
            if (Object.values(data).some(status => status === true)) {
              fetchAvailableModels();
              fetchSystemConfig();
            }
          }
        } catch (error) {
          console.error('Error fetching model loading status:', error);
        }
      }, 3000);
      
      return () => clearInterval(interval);
    };
    
    return pollModelLoadingStatus();
  }, []);

  // Auto-refresh conversation
  useEffect(() => {
    const startTimer = () => {
      console.log(`Starting auto-refresh timer: ${autoRefreshInterval} seconds`);
      autoRefreshTimerRef.current = setInterval(() => {
        if (!loading && selectedConversation) {
          continueConversation();
        }
      }, autoRefreshInterval * 1000);
    };

    const clearTimer = () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
      }
    };

    clearTimer();
    if (autoRefresh && selectedConversation) {
      startTimer();
    }
  
    return clearTimer;
  }, [autoRefresh, autoRefreshInterval, selectedConversation, loading]);

  // Data fetching functions
  const fetchCharacters = async () => {
    try {
      const response = await fetch(`${API_URL}/characters`);
      if (response.ok) {
        const data = await response.json();
        setCharacters(data);
      } else {
        console.error('Failed to fetch characters');
      }
    } catch (error) {
      console.error('Error fetching characters:', error);
    }
  };

  const fetchConversations = async () => {
    try {
      const response = await fetch(`${API_URL}/conversations`);
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      } else {
        console.error('Failed to fetch conversations');
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const fetchConversationDetails = async (conversationId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/conversations/${conversationId}`);
      if (response.ok) {
        const data = await response.json();
        setConversationDetails(data);
      } else {
        console.error('Failed to fetch conversation details');
      }
    } catch (error) {
      console.error('Error fetching conversation details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemConfig = async () => {
    try {
      const response = await fetch(`${API_URL}/system/config`);
      if (response.ok) {
        const data = await response.json();
        setSystemConfig(data);
      } else {
        console.error('Failed to fetch system config');
      }
    } catch (error) {
      console.error('Error fetching system config:', error);
    }
  };

  const fetchAvailableModels = async () => {
    setRefreshingModels(true);
    try {
      const response = await fetch(`${API_URL}/system/models`);
      if (response.ok) {
        const data = await response.json();
        setAvailableModels(data);
      } else {
        console.error('Failed to fetch available models');
      }
    } catch (error) {
      console.error('Error fetching available models:', error);
    } finally {
      setRefreshingModels(false);
    }
  };

  const checkHealth = async () => {
    try {
      const response = await fetch(`${API_URL}/health`);
      if (response.ok) {
        const data = await response.json();
        setHealthStatus(data);
      }
    } catch (error) {
      console.error('Error checking health:', error);
      setHealthStatus({ status: 'error', message: error.message });
    }
  };

  // Action functions
  const handleCreateCharacter = async () => {
    try {
      const response = await fetch(`${API_URL}/characters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newCharacter),
      });
      
      if (response.ok) {
        setNotification({ 
          open: true, 
          message: `Character ${newCharacter.name} created successfully!`, 
          severity: 'success' 
        });
        setOpenCreateCharacter(false);
        setNewCharacter({
          name: '',
          system_prompt: '',
          personality_traits: {}
        });
        fetchCharacters();
      } else {
        const error = await response.json();
        setNotification({ 
          open: true, 
          message: `Failed to create character: ${error.detail}`, 
          severity: 'error' 
        });
      }
    } catch (error) {
      setNotification({ 
        open: true, 
        message: `Error creating character: ${error.message}`, 
        severity: 'error' 
      });
    }
  };

  const handleCreateConversation = async () => {
    try {
      if (newConversation.characters.length < 2) {
        setNotification({ 
          open: true, 
          message: 'Please select at least 2 characters for the conversation', 
          severity: 'warning' 
        });
        return;
      }
      
      setLoading(true);
      const response = await fetch(`${API_URL}/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConversation),
      });
      
      if (response.ok) {
        const data = await response.json();
        setNotification({ 
          open: true, 
          message: 'Conversation created successfully!', 
          severity: 'success' 
        });
        setOpenCreateConversation(false);
        setNewConversation({
          characters: [],
          initial_message: '',
          num_turns: 5
        });
        fetchConversations();
        setSelectedConversation(data.id);
      } else {
        const error = await response.json();
        setNotification({ 
          open: true, 
          message: `Failed to create conversation: ${error.detail}`, 
          severity: 'error' 
        });
      }
    } catch (error) {
      setNotification({ 
        open: true, 
        message: `Error creating conversation: ${error.message}`, 
        severity: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSystemConfig = async () => {
    try {
      const response = await fetch(`${API_URL}/system/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(systemConfig),
      });
      
      if (response.ok) {
        setNotification({ 
          open: true, 
          message: 'System configuration updated successfully!', 
          severity: 'success' 
        });
      } else {
        const error = await response.json();
        setNotification({ 
          open: true, 
          message: `Failed to update system configuration: ${error.detail}`, 
          severity: 'error' 
        });
      }
    } catch (error) {
      setNotification({ 
        open: true, 
        message: `Error updating system configuration: ${error.message}`, 
        severity: 'error' 
      });
    }
  };

  const handleLoadModel = async (modelName) => {
    try {
      // Check if the model is already loading
      if (modelLoadingStatus[modelName]) {
        setNotification({
          open: true,
          message: `Model ${modelName} is already loading...`,
          severity: 'info'
        });
        return;
      }
      
      const response = await fetch(`${API_URL}/system/models/load`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model_name: modelName }),
      });
      
      if (response.ok) {
        setNotification({ 
          open: true, 
          message: `Started loading model ${modelName}. This may take a few minutes.`, 
          severity: 'info' 
        });
        
        // Update loading status immediately for better UX
        setModelLoadingStatus(prev => ({...prev, [modelName]: true}));
      } else {
        const error = await response.json();
        setNotification({ 
          open: true, 
          message: `Failed to load model: ${error.detail}`, 
          severity: 'error' 
        });
      }
    } catch (error) {
      setNotification({ 
        open: true, 
        message: `Error loading model: ${error.message}`, 
        severity: 'error' 
      });
    }
  };

  const continueConversation = React.useCallback(async () => {
    if (!selectedConversation || loading) return;
    
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/conversations/${selectedConversation}/continue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ num_turns: 1 }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setConversationDetails(data);
        setNotification({ 
          open: true, 
          message: 'Conversation continued!', 
          severity: 'success' 
        });
      } else {
        const error = await response.json();
        setNotification({ 
          open: true, 
          message: `Failed to continue conversation: ${error.detail}`, 
          severity: 'error' 
        });
        // Disable auto-refresh if there's an error
        setAutoRefresh(false);
      }
    } catch (error) {
      setNotification({ 
        open: true, 
        message: `Error continuing conversation: ${error.message}`, 
        severity: 'error' 
      });
      // Disable auto-refresh if there's an error
      setAutoRefresh(false);
    } finally {
      setLoading(false);
    }
  }, [selectedConversation, loading]);

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  const getCharacterColor = (name) => {
    // Simple hash function to generate consistent colors
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 50%)`;
  };

  const getModelStatusLabel = (modelName) => {
    if (modelLoadingStatus[modelName]) {
      return "Loading...";
    }
    if (systemConfig.active_model === modelName) {
      return "Active";
    }
    return "Available";
  };

  const getModelStatusColor = (modelName) => {
    if (modelLoadingStatus[modelName]) {
      return "orange";
    }
    if (systemConfig.active_model === modelName) {
      return "green";
    }
    return "gray";
  };

  return (
    <ThemeProvider theme={theme}>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h3" component="h1" gutterBottom>
            AI Character Conversations
          </Typography>
          <Button 
            variant="outlined" 
            startIcon={<div>⚙️</div>} 
            onClick={() => setOpenSettings(true)}
          >
            Settings
          </Button>
        </Box>

        <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip 
            label={`Model: ${systemConfig.active_model}`} 
            color={modelLoadingStatus[systemConfig.active_model] ? "warning" : "primary"}
            size="medium"
          />
          {modelLoadingStatus[systemConfig.active_model] && (
            <CircularProgress size={20} />
          )}
        </Box>
        
        <Box sx={{ mb: 4 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h5" component="div" gutterBottom>
                    Characters
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {characters.length} characters available
                    </Typography>
                    <Button 
                      variant="contained" 
                      size="small"
                      onClick={() => setOpenCreateCharacter(true)}
                    >
                      Create Character
                    </Button>
                  </Box>
                  <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                    {characters.map((character) => (
                      <React.Fragment key={character}>
                        <ListItem>
                          <Chip 
                            label={character} 
                            style={{ backgroundColor: getCharacterColor(character), color: 'white' }}
                          />
                        </ListItem>
                        <Divider component="li" />
                      </React.Fragment>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h5" component="div" gutterBottom>
                    Conversations
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {conversations.length} conversations
                    </Typography>
                    <Button 
                      variant="contained" 
                      size="small"
                      onClick={() => setOpenCreateConversation(true)}
                      disabled={characters.length < 2}
                    >
                      New Conversation
                    </Button>
                  </Box>
                  <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                    {conversations.map((conversation) => (
                      <React.Fragment key={conversation}>
                        <ListItem button onClick={() => setSelectedConversation(conversation)}>
                          <Typography 
                            variant="body1"
                            color={selectedConversation === conversation ? 'primary' : 'textPrimary'}
                          >
                            {conversation.substring(0, 8)}...
                          </Typography>
                        </ListItem>
                        <Divider component="li" />
                      </React.Fragment>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
        
        {selectedConversation && (
          <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h5" component="h2">
                Conversation {selectedConversation.substring(0, 8)}...
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Auto-continue"
                />
                {autoRefresh && (
                  <TextField
                    label="Interval (seconds)"
                    type="number"
                    size="small"
                    value={autoRefreshInterval}
                    onChange={(e) => setAutoRefreshInterval(Math.max(1, parseInt(e.target.value) || 10))}
                    inputProps={{ min: 1 }}
                    sx={{ width: 150 }}
                  />
                )}
                <Button 
                  variant="contained" 
                  onClick={continueConversation}
                  disabled={loading}
                >
                  {loading ? <CircularProgress size={24} /> : 'Continue Conversation'}
                </Button>
              </Box>
            </Box>
            
            {loading && !conversationDetails ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : conversationDetails ? (
              <>
                <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
                  <Typography variant="body2">Characters:</Typography>
                  {conversationDetails.characters.map((character) => (
                    <Chip 
                      key={character}
                      label={character} 
                      size="small"
                      style={{ backgroundColor: getCharacterColor(character), color: 'white' }}
                    />
                  ))}
                </Box>
                
                <List>
                  {conversationDetails.messages.slice().reverse().map((message, index) => {
                    if (message.role === 'system') return null;
                    
                    return (
                      <React.Fragment key={conversationDetails.messages.length - index - 1}>
                        <ListItem alignItems="flex-start">
                          <Box 
                            sx={{ 
                              display: 'flex', 
                              flexDirection: 'column', 
                              width: '100%',
                              bgcolor: message.role === conversationDetails.characters[0] ? 'rgba(63, 81, 181, 0.1)' : 'rgba(245, 0, 87, 0.1)',
                              borderRadius: 2,
                              p: 2
                            }}
                          >
                            <Typography 
                              variant="subtitle1" 
                              fontWeight="bold"
                              color={getCharacterColor(message.role)}
                            >
                              {message.role}
                            </Typography>
                            <Typography variant="body1" style={{ whiteSpace: 'pre-wrap' }}>
                              {message.content}
                            </Typography>
                          </Box>
                        </ListItem>
                        <Divider component="li" />
                      </React.Fragment>
                    );
                  })}
                </List>
              </>
            ) : (
              <Typography variant="body1">Select a conversation to view details</Typography>
            )}
          </Paper>
        )}
        
        {/* Create Character Dialog */}
        <Dialog open={openCreateCharacter} onClose={() => setOpenCreateCharacter(false)} fullWidth maxWidth="md">
          <DialogTitle>Create New AI Character</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  label="Character Name"
                  fullWidth
                  value={newCharacter.name}
                  onChange={(e) => setNewCharacter({...newCharacter, name: e.target.value})}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="System Prompt"
                  fullWidth
                  multiline
                  rows={6}
                  value={newCharacter.system_prompt}
                  onChange={(e) => setNewCharacter({...newCharacter, system_prompt: e.target.value})}
                  helperText="Describe the character's personality, knowledge, and behavior"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenCreateCharacter(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateCharacter} 
              variant="contained"
              disabled={!newCharacter.name || !newCharacter.system_prompt}
            >
              Create Character
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* Create Conversation Dialog */}
        <Dialog open={openCreateConversation} onClose={() => setOpenCreateConversation(false)} fullWidth maxWidth="md">
          <DialogTitle>Start New Conversation</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Select Characters</InputLabel>
                  <Select
                    multiple
                    value={newConversation.characters}
                    onChange={(e) => setNewConversation({...newConversation, characters: e.target.value})}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip 
                            key={value} 
                            label={value} 
                            size="small"
                            style={{ backgroundColor: getCharacterColor(value), color: 'white' }}
                          />
                        ))}
                      </Box>
                    )}
                  >
                    {characters.map((character) => (
                      <MenuItem key={character} value={character}>
                        {character}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Initial Message"
                  fullWidth
                  multiline
                  rows={4}
                  value={newConversation.initial_message}
                  onChange={(e) => setNewConversation({...newConversation, initial_message: e.target.value})}
                  helperText={`This will be spoken by ${newConversation.characters[0] || 'the first character'}`}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Number of Turns"
                  type="number"
                  fullWidth
                  value={newConversation.num_turns}
                  onChange={(e) => setNewConversation({...newConversation, num_turns: parseInt(e.target.value)})}
                  inputProps={{ min: 1, max: 20 }}
                  helperText="How many exchanges to generate initially"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenCreateConversation(false)}>Cancel</Button>
	  <Button 
              onClick={handleCreateConversation} 
              variant="contained"
              disabled={
                newConversation.characters.length < 2 || 
                !newConversation.initial_message ||
                loading
              }
            >
              {loading ? <CircularProgress size={24} /> : 'Start Conversation'}
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* Settings Dialog */}
        <Dialog open={openSettings} onClose={() => setOpenSettings(false)} fullWidth maxWidth="md">
          <DialogTitle>System Settings</DialogTitle>
          <DialogContent>
            <Tabs 
              value={settingsTab} 
              onChange={(e, newValue) => setSettingsTab(newValue)}
              centered
              sx={{ mb: 2 }}
            >
              <Tab label="Model Settings" />
              <Tab label="Available Models" />
            </Tabs>
            
            {settingsTab === 0 && (
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Model Configuration
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Active Model</InputLabel>
                    <Select
                      value={systemConfig.active_model}
                      onChange={(e) => setSystemConfig({...systemConfig, active_model: e.target.value})}
                      disabled={Object.values(modelLoadingStatus).some(status => status === true)}
                    >
                      {availableModels.map((model) => (
                        <MenuItem key={model.name} value={model.name}>
                          {model.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <Typography id="temperature-slider" gutterBottom>
                    Temperature: {systemConfig.temperature}
                  </Typography>
                  <Slider
                    value={systemConfig.temperature}
                    onChange={(e, newValue) => setSystemConfig({...systemConfig, temperature: newValue})}
                    aria-labelledby="temperature-slider"
                    step={0.1}
                    marks
                    min={0}
                    max={2}
                    valueLabelDisplay="auto"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography id="max-tokens-slider" gutterBottom>
                    Max Tokens: {systemConfig.max_tokens}
                  </Typography>
                  <Slider
                    value={systemConfig.max_tokens}
                    onChange={(e, newValue) => setSystemConfig({...systemConfig, max_tokens: newValue})}
                    aria-labelledby="max-tokens-slider"
                    step={128}
                    marks
                    min={256}
                    max={4096}
                    valueLabelDisplay="auto"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button 
                    variant="contained" 
                    onClick={handleUpdateSystemConfig}
                    disabled={Object.values(modelLoadingStatus).some(status => status === true)}
                  >
                    Save Configuration
                  </Button>
                </Grid>
              </Grid>
            )}
            
            {settingsTab === 1 && (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    Available Models
                  </Typography>
                  <Button 
                    variant="outlined" 
                    onClick={fetchAvailableModels}
                    disabled={refreshingModels}
                    startIcon={refreshingModels ? <CircularProgress size={16} /> : <div>🔄</div>}
                  >
                    Refresh
                  </Button>
                </Box>
                <List>
                  {availableModels.map((model) => (
                    <ListItem 
                      key={model.name}
                      secondaryAction={
                        <Button 
                          variant="contained"
                          color={systemConfig.active_model === model.name ? "success" : "primary"}
                          disabled={
                            modelLoadingStatus[model.name] || 
                            systemConfig.active_model === model.name ||
                            Object.values(modelLoadingStatus).some(status => status === true)
                          }
                          onClick={() => handleLoadModel(model.name)}
                        >
                          {modelLoadingStatus[model.name] ? (
                            <React.Fragment>
                              <CircularProgress size={24} sx={{ mr: 1 }} /> Loading...
                            </React.Fragment>
                          ) : systemConfig.active_model === model.name ? (
                            "Active"
                          ) : (
                            "Load Model"
                          )}
                        </Button>
                      }
                    >
                      <ListItemText 
                        primary={model.name} 
                        secondary={
                          <React.Fragment>
                            <Typography component="span" variant="body2" sx={{ display: 'block' }}>
                              Size: {model.size ? (model.size / (1024*1024*1024)).toFixed(1) + " GB" : "Unknown"}
                            </Typography>
                            <Typography component="span" variant="body2">
                              Status: <span style={{ color: getModelStatusColor(model.name) }}>
                                {getModelStatusLabel(model.name)}
                              </span>
                            </Typography>
                          </React.Fragment>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenSettings(false)}>Close</Button>
          </DialogActions>
        </Dialog>
        
        {/* Notifications */}
        <Snackbar 
          open={notification.open} 
          autoHideDuration={6000} 
          onClose={handleCloseNotification}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert onClose={handleCloseNotification} severity={notification.severity}>
            {notification.message}
          </Alert>
        </Snackbar>
        
      </Container>
    </ThemeProvider>
  );
}

export default App;
