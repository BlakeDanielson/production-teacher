'use client';

import { useEffect, useState } from "react";
import { Title, Text, Stack, TextInput, PasswordInput, Button, Group, Select, Alert, Card } from '@mantine/core';
import { IconDeviceFloppy, IconKey, IconSettings, IconCheck, IconX } from '@tabler/icons-react';
import { useAppStore } from '@/store/store';
import { AnalysisModel } from '@/types';

export default function SettingsPage() {
  // --- Get state and actions from Zustand store --- 
  const {
    googleApiKey,
    openaiApiKey,
    defaultAnalysisModel,
    isSettingsLoaded,
    setGoogleApiKey,
    setOpenaiApiKey,
    setDefaultAnalysisModel,
    loadSettings,
    saveSettings
  } = useAppStore();
  
  const [isSaving, setIsSaving] = useState(false);

  // --- Effects --- 
  // Load settings via store action on mount (already called outside component)
  // useEffect(() => {
  //   if (!isSettingsLoaded) {
  //     loadSettings(); 
  //   }
  // }, [isSettingsLoaded, loadSettings]);

  // --- Handlers --- 
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await saveSettings();
    } catch (error) {
      console.error("Save settings failed (error caught in component)", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Prevent rendering form until settings are loaded from localStorage
  if (!isSettingsLoaded) {
    return <Text>Loading settings...</Text>;
  }

  return (
    <Stack gap="xl">
      <Title order={2}>Settings</Title>
      <Text c="dimmed">Manage your application settings and API keys.</Text>
      
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="lg">
           <Title order={4}>API Keys</Title>
           <Text size="sm" c="dimmed">Enter your API keys for Google Gemini and OpenAI. These are stored securely in your browser's local storage.</Text>
           <PasswordInput
             label="Google Gemini API Key"
             placeholder="Enter your Google API Key"
             value={googleApiKey || ''}
             onChange={(event) => setGoogleApiKey(event.currentTarget.value)}
             required
             leftSection={<IconKey size={16} />}
           />
           <PasswordInput
             label="OpenAI API Key"
             placeholder="Enter your OpenAI API Key (e.g., sk-...)"
             value={openaiApiKey || ''}
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