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
  FormControlLabel
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
  console.log("App component");
  const [characters, setCharacters] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [conversationDetails, setConversationDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [openCreateCharacter, setOpenCreateCharacter] = useState(false);
  const [openCreateConversation, setOpenCreateConversation] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(10);
  const autoRefreshTimerRef = React.useRef(null);
  // New character form state
  const [newCharacter, setNewCharacter] = useState({
    name: '',
    model: 'llama3:8b',
    system_prompt: '',
    temperature: 0.7,
    max_tokens: 1024,
    personality_traits: {}
  });
  
  // New conversation form state
  const [newConversation, setNewConversation] = useState({
    characters: [],
    initial_message: '',
    num_turns: 5
  });

  useEffect(() => {
    fetchCharacters();
    fetchConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      fetchConversationDetails(selectedConversation);
    }
  }, [selectedConversation]);

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
          model: 'llama3:8b',
          system_prompt: '',
          temperature: 0.7,
          max_tokens: 1024,
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
  }, [selectedConversation, loading, API_URL, setAutoRefresh]);


  useEffect(() => {
    console.log("Auto-refresh effect triggered:", { autoRefresh, selectedConversation, loading });
  
    const startTimer = () => {
      console.log(`Starting auto-refresh timer: ${autoRefreshInterval} seconds`);
      autoRefreshTimerRef.current = setInterval(() => {
        console.log("Auto-refresh interval fired, continuing conversation...");
        if (!loading && selectedConversation) {
          continueConversation();
        } else {
          console.log("Skipping auto-refresh due to loading state or no conversation selected");
        }
      }, autoRefreshInterval * 1000);
    };

    const clearTimer = () => {
      if (autoRefreshTimerRef.current) {
        console.log("Clearing existing auto-refresh timer");
        clearInterval(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
      }
    };

    // Clear any existing timer
    clearTimer();
  
    // Start a new timer if conditions are met
    if (autoRefresh && selectedConversation) {
      startTimer();
    }
  
    // Cleanup function
    return clearTimer;
  }, [autoRefresh, autoRefreshInterval, selectedConversation, loading, continueConversation]);


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

  return (
    <ThemeProvider theme={theme}>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom align="center">
          AI Character Conversations
        </Typography>
        
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
                  <List>
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
                  <List>
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
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Character Name"
                  fullWidth
                  value={newCharacter.name}
                  onChange={(e) => setNewCharacter({...newCharacter, name: e.target.value})}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Model"
                  fullWidth
                  value={newCharacter.model}
                  onChange={(e) => setNewCharacter({...newCharacter, model: e.target.value})}
                  helperText="Model name in Ollama (e.g., llama3:8b, deepseek:7b, ...)"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Temperature"
                  type="number"
                  fullWidth
                  value={newCharacter.temperature}
                  onChange={(e) => setNewCharacter({...newCharacter, temperature: parseFloat(e.target.value)})}
                  inputProps={{ min: 0, max: 2, step: 0.1 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Max Tokens"
                  type="number"
                  fullWidth
                  value={newCharacter.max_tokens}
                  onChange={(e) => setNewCharacter({...newCharacter, max_tokens: parseInt(e.target.value)})}
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
              disabled={!newCharacter.name || !newCharacter.model || !newCharacter.system_prompt}
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
