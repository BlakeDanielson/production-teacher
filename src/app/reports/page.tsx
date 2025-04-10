'use client';

import { useState, useEffect } from "react";
import { 
  Title, Text, Stack, Table, Checkbox, Button, Group, Modal, Alert, 
  ScrollArea, Skeleton, Center, Loader, Paper, Badge
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import { IconAlertTriangle, IconTrash, IconFlask } from '@tabler/icons-react'; // Removed unused IconX, IconCopy
import ReactMarkdown from "react-markdown";
import { useAppStore } from '@/store/store';
import { ReportMetadata } from '@/types';

export default function ReportsPage() {
  // --- Get state and actions from Zustand store --- 
  const {
    savedReports,
    isLoadingReports,
    fetchError,
    fetchReports,
    deleteReport
  } = useAppStore();

  // --- Local State for this page --- 
  const [selectedReportIds, setSelectedReportIds] = useState<Set<string>>(new Set()); 
  const [isSynthesizing, setIsSynthesizing] = useState(false); 
  const [synthesisResult, setSynthesisResult] = useState<string | null>(null); 
  const [synthesisError, setSynthesisError] = useState<string | null>(null); 
  const [openedModal, { open: openModal, close: closeModal }] = useDisclosure(false);

  // --- Effects --- 
  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // --- Handlers --- 
  const handleSynthesize = async () => {
    if (selectedReportIds.size < 2) {
      notifications.show({ title: 'Selection Required', message: 'Please select at least two reports to synthesize.', color: 'orange' });
      return;
    }
    setIsSynthesizing(true);
    setSynthesisError(null);
    setSynthesisResult(null);
    openModal();

    try {
      const response = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportIds: Array.from(selectedReportIds) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `API request failed`);
      setSynthesisResult(data.synthesisResult);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Synthesis failed.";
      setSynthesisError(errorMsg);
      notifications.show({ title: 'Synthesis Failed', message: errorMsg, color: 'red' });
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleCheckboxChange = (reportId: string, isChecked: boolean) => {
    setSelectedReportIds(prev => {
      const newSet = new Set(prev);
      if (isChecked) newSet.add(reportId);
      else newSet.delete(reportId);
      return newSet;
    });
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
            onClick={() => deleteReport(report.id)}
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

      {fetchError && (
        <Alert variant="light" color="red" title="Error Loading Reports" icon={<IconAlertTriangle />}>
          {fetchError}
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

        <ScrollArea h={isLoadingReports ? 200 : undefined} mah={500}>
          {isLoadingReports ? (
            <Stack>
              {[...Array(3)].map((_, i) => <Skeleton key={i} h={40} radius="sm" />)}
            </Stack>
          ) : savedReports.length > 0 ? (
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={40}></Table.Th>
                  <Table.Th>ID</Table.Th>
                  <Table.Th>Source URL</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th w={100}></Table.Th>
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
