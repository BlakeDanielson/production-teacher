'use client';

import { useState, useEffect } from "react"; 
import { Title, Text, Stack, TextInput, PasswordInput, Button, Group, Select, Alert, Card } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy, IconKey, IconSettings, IconCheck, IconX } from '@tabler/icons-react';

// Define type for analysis model preference if needed
type AnalysisModel = 'gemini' | 'gpt4';

export default function SettingsPage() {
  // --- State --- 
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [defaultAnalysisModel, setDefaultAnalysisModel] = useState<AnalysisModel>('gemini');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // --- Effects --- 
  // Load settings from local storage on component mount
  useEffect(() => {
    const storedGoogleKey = localStorage.getItem('googleApiKey');
    const storedOpenaiKey = localStorage.getItem('openaiApiKey');
    const storedModel = localStorage.getItem('defaultAnalysisModel') as AnalysisModel;
    if (storedGoogleKey) setGoogleApiKey(storedGoogleKey);
    if (storedOpenaiKey) setOpenaiApiKey(storedOpenaiKey);
    if (storedModel) setDefaultAnalysisModel(storedModel);
  }, []);

  // --- Handlers --- 
  const handleSaveSettings = () => {
    setIsSaving(true);
    try {
      // Basic validation (can be enhanced)
      if (!googleApiKey || !openaiApiKey) {
         notifications.show({ 
           title: 'Missing Keys', 
           message: 'Please provide both Google Gemini and OpenAI API keys.', 
           color: 'orange' 
         });
         setIsSaving(false);
         return;
      }
      
      // Save to local storage (replace with API call later if needed)
      localStorage.setItem('googleApiKey', googleApiKey);
      localStorage.setItem('openaiApiKey', openaiApiKey);
      localStorage.setItem('defaultAnalysisModel', defaultAnalysisModel);
      
      notifications.show({ 
        title: 'Settings Saved', 
        message: 'Your settings have been saved successfully.', 
        color: 'green',
        icon: <IconCheck />
      });
    } catch (error) {
      console.error("Error saving settings:", error);
       notifications.show({ 
         title: 'Error', 
         message: 'Could not save settings.', 
         color: 'red',
         icon: <IconX />
       });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Stack gap="xl">
      <Title order={2}>Settings</Title>
      <Text c="dimmed">Manage your application settings and API keys.</Text>
      
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="lg">
           <Title order={4}>API Keys</Title>
           <Text size="sm" c="dimmed">Enter your API keys for Google Gemini and OpenAI. These are stored securely in your browser's local storage and are not sent anywhere else unless used for analysis.</Text>
           <PasswordInput
             label="Google Gemini API Key"
             placeholder="Enter your Google API Key"
             value={googleApiKey}
             onChange={(event) => setGoogleApiKey(event.currentTarget.value)}
             required
             leftSection={<IconKey size={16} />}
           />
           <PasswordInput
             label="OpenAI API Key"
             placeholder="Enter your OpenAI API Key (e.g., sk-...)"
             value={openaiApiKey}
             onChange={(event) => setOpenaiApiKey(event.currentTarget.value)}
             required
             leftSection={<IconKey size={16} />}
           />
           
           <Alert variant="light" color="blue" title="Security Note" icon={<IconKey />}>
              API keys are sensitive. Ensure you are using this application in a secure environment.
           </Alert>
        </Stack>
      </Card>
      
       <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="lg">
           <Title order={4}>Preferences</Title>
            <Select
             label="Default Analysis Model"
             value={defaultAnalysisModel}
             onChange={(value) => setDefaultAnalysisModel(value as AnalysisModel)}
             data={[
               { value: 'gemini', label: 'Gemini (Recommended)' },
               { value: 'gpt4', label: 'GPT-4' },
             ]}
           />
        </Stack>
      </Card>

      <Group justify="flex-end" mt="md">
        <Button 
          onClick={handleSaveSettings}
          leftSection={<IconDeviceFloppy size={16} />}
          loading={isSaving}
        >
          Save Settings
        </Button>
      </Group>

    </Stack>
  );
} 