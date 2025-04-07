'use client';

import { useState, useEffect } from "react";
import { 
  Title, Text, Stack, Table, Checkbox, Button, Group, Modal, Alert, 
  ScrollArea, Skeleton, Center, Loader, Paper, Badge
} from '@mantine/core';
import { notifications } from '@mantine/notifications'; // For feedback
import { useDisclosure } from '@mantine/hooks';
import { IconX, IconAlertTriangle, IconTrash, IconCopy, IconFlask } from '@tabler/icons-react'; // For notifications
import ReactMarkdown from "react-markdown"; // For synthesis result

// Import shared types
import { ReportMetadata } from '@/types';

export default function ReportsPage() {
  // --- Reports State --- 
  const [savedReports, setSavedReports] = useState<ReportMetadata[]>([]); 
  const [selectedReportIds, setSelectedReportIds] = useState<Set<string>>(new Set()); 
  const [isSynthesizing, setIsSynthesizing] = useState(false); 
  const [synthesisResult, setSynthesisResult] = useState<string | null>(null); 
  const [synthesisError, setSynthesisError] = useState<string | null>(null); 
  const [error, setError] = useState<string | null>(null); // General error state for this page
  const [isLoadingReports, setIsLoadingReports] = useState(true); // Loading state for initial fetch
  const [openedModal, { open: openModal, close: closeModal }] = useDisclosure(false); // Modal state

  // --- Effects --- 
  useEffect(() => {
    fetchReports();
  }, []);

  // --- Handlers --- 
  const fetchReports = async () => {
    setIsLoadingReports(true);
    setError(null); // Clear previous errors
    try {
      const response = await fetch('/api/reports');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to fetch reports: ${response.statusText}`);
      }
      const data: ReportMetadata[] = await response.json();
      setSavedReports(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Could not load saved reports.";
      console.error("Error fetching reports:", err);
      setError(errorMsg); 
      notifications.show({ title: 'Error Loading Reports', message: errorMsg, color: 'red', icon: <IconX /> });
    } finally {
      setIsLoadingReports(false);
    }
  };

  const handleSynthesize = async () => {
    if (selectedReportIds.size < 2) {
      notifications.show({ title: 'Selection Required', message: 'Please select at least two reports to synthesize.', color: 'orange', icon: <IconAlertTriangle /> });
      return;
    }
    setIsSynthesizing(true);
    setSynthesisError(null);
    setSynthesisResult(null);
    openModal(); // Open the modal immediately

    try {
      const response = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportIds: Array.from(selectedReportIds) }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `API request failed`);
      }
      setSynthesisResult(data.synthesisResult);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Synthesis failed.";
      console.error("Error calling synthesize API:", err);
      setSynthesisError(errorMsg);
      notifications.show({ title: 'Synthesis Failed', message: errorMsg, color: 'red', icon: <IconX /> });
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleCheckboxChange = (reportId: string, isChecked: boolean) => {
    setSelectedReportIds(prev => {
      const newSet = new Set(prev);
      if (isChecked) {
        newSet.add(reportId);
      } else {
        newSet.delete(reportId);
      }
      return newSet;
    });
  };
  
  const handleDeleteReport = async (id: string) => {
    if (!confirm(`Delete report ${id}? This cannot be undone.`)) return;
    try {
      const response = await fetch(`/api/reports?id=${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete report');
      }
      console.log(`Report ${id} deleted.`);
      notifications.show({ title: 'Report Deleted', message: `Report ${id} successfully deleted.`, color: 'green' });
      fetchReports(); // Refresh the list
    } catch (err) {
       const errorMsg = err instanceof Error ? err.message : "Could not delete the report.";
      console.error(`Error deleting report ${id}:`, err);
      setError(errorMsg); // Show error on page as well
      notifications.show({ title: 'Delete Failed', message: errorMsg, color: 'red', icon: <IconX /> });
    }
  };

  // --- UI Rendering --- 
  const rows = savedReports.map((report: ReportMetadata) => (
    <Table.Tr key={report.id}>
      <Table.Td>
        <Checkbox
          checked={selectedReportIds.has(report.id)}
          onChange={(event) => handleCheckboxChange(report.id, event.currentTarget.checked)}
          aria-label={`Select report ${report.id}`}
        />
      </Table.Td>
      <Table.Td>
         <Text size="xs" c="dimmed">{report.id.substring(0, 8)}...</Text>
      </Table.Td>
      <Table.Td>
          <Text size="sm" truncate maw={300} title={report.youtube_url}>{report.youtube_url}</Text>
      </Table.Td>
      <Table.Td>
        <Badge variant="light" color={report.analysis_type === 'video' ? 'violet' : 'cyan'}>
            {report.analysis_type}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{new Date(report.created_at).toLocaleString()}</Text>
      </Table.Td>
      <Table.Td>
        <Group gap="xs" justify="flex-end">
          <Button 
            size="xs" 
            variant="light" 
            color="red" 
            onClick={() => handleDeleteReport(report.id)}
            leftSection={<IconTrash size={14} />}
           >
             Delete
           </Button>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Stack gap="xl">
      <Title order={2}>Reports</Title>
      <Text c="dimmed">View, compare, and manage your saved analysis reports.</Text>

      {error && (
        <Alert variant="light" color="red" title="Error Loading Reports" icon={<IconAlertTriangle />}>
          {error}
        </Alert>
      )}

      <Paper shadow="sm" p="lg" radius="md" withBorder>
        <Group justify="flex-end" mb="md">
            <Button
              onClick={handleSynthesize}
              disabled={selectedReportIds.size < 2 || isSynthesizing}
              leftSection={<IconFlask size={16} />}
             >
               {`Synthesize Selected (${selectedReportIds.size})`}
             </Button>
        </Group>

        <ScrollArea h={isLoadingReports ? 200 : undefined} mah={500}> {/* Set height for loading state */}
          {isLoadingReports ? (
            <Stack>
              {[...Array(3)].map((_, i) => <Skeleton key={i} h={40} radius="sm" />)}
            </Stack>
          ) : savedReports.length > 0 ? (
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={40}></Table.Th> {/* Checkbox col */} 
                  <Table.Th>ID</Table.Th>
                  <Table.Th>Source URL</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th w={100}></Table.Th> {/* Actions col */} 
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{rows}</Table.Tbody>
            </Table>
          ) : (
             <Center mih={200}>
               <Text c="dimmed">No reports saved yet.</Text>
             </Center>
           )}
        </ScrollArea>
      </Paper>

      {/* Synthesis Modal */}
      <Modal opened={openedModal} onClose={closeModal} title="Synthesis Result" size="xl">
        {isSynthesizing && (
          <Center>
            <Loader />
            <Text ml="sm">Synthesizing insights...</Text>
          </Center>
        )}
        {synthesisError && (
          <Alert variant="light" color="red" title="Synthesis Error" icon={<IconAlertTriangle />}>
            {synthesisError}
          </Alert>
        )}
        {synthesisResult && (
          <Paper bg="dark.8" p="md" radius="sm">
            <ReactMarkdown>{synthesisResult}</ReactMarkdown>
          </Paper>
        )}
      </Modal>
    </Stack>
  );
} 