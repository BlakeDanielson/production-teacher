'use client';

import { Title, Text, Stack } from '@mantine/core';

export default function ReportsPage() {
  // TODO: Move reports state, handlers, and UI components here
  // State: savedReports, selectedReportIds, isComparing, comparisonResult, etc.
  // Handlers: fetchReports, handleDeleteReport, handleCompareReports, handleCheckboxChange, etc.
  // UI: Reports list, comparison section
  
  return (
    <Stack>
      <Title order={2}>Reports</Title>
      <Text c="dimmed">View, compare, and manage your saved analysis reports.</Text>
      {/* Placeholder for reports UI */}
      <Text>Reports management features will be implemented here.</Text>
    </Stack>
  );
} 