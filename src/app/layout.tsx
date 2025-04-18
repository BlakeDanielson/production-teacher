'use client'; // Required for Mantine context

// Removed unused Metadata import
import { Inter } from "next/font/google";
import "@mantine/core/styles.css"; // Import Mantine core styles
import "@mantine/notifications/styles.css"; // Import notification styles
import "./globals.css";
import { MantineProvider, ColorSchemeScript, AppShell, Burger, Group, NavLink, Box } from '@mantine/core'; // Removed unused Text as MantineText
import { Notifications } from '@mantine/notifications'; // Import Notifications provider
import { useDisclosure } from '@mantine/hooks';
import Link from 'next/link';
import { usePathname } from 'next/navigation'; // Import usePathname
import { IconBrandYoutube, IconFileCheck, IconChartBar, IconSettings } from '@tabler/icons-react'; // Tabler icons

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-sans"
});

// Define nav items data
const navItems = [
  { href: "/", label: "YouTube Analysis", icon: IconBrandYoutube },
  { href: "/transcription", label: "Transcription", icon: IconFileCheck },
  { href: "/reports", label: "Reports", icon: IconChartBar },
  { href: "/settings", label: "Settings", icon: IconSettings },
];

// Removed Metadata export as it can cause issues in client components
// export const metadata: Metadata = { ... }; 
// You might need to handle metadata differently, perhaps in page.tsx or a dedicated head.js

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [opened, { toggle }] = useDisclosure(); // Hook for mobile burger menu
  const pathname = usePathname(); // Get current path

  return (
    <html lang="en">
      <head>
        <ColorSchemeScript defaultColorScheme="dark" /> 
      </head>
      {/* 
        Removed dark class from html and font-sans from body, 
        MantineProvider will handle theme and font application 
      */}
      <body className={`${inter.variable}`}> 
        <MantineProvider defaultColorScheme="dark"> 
          <Notifications position="top-right" /> {/* Add Notifications container */}
          <AppShell
            header={{ height: 60 }}
            navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !opened, desktop: false } }}
            padding="md"
          >
            <AppShell.Header 
              style={{ borderBottom: '1px solid var(--mantine-color-dark-5)' }}
            >
              <Group h="100%" px="md">
                {/* Burger menu for mobile */}
                <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
                {/* Changed h1 to Box with MantineText for better theme integration */}
                <Box style={{ fontFamily: 'var(--font-sans)', fontWeight: 'bold', fontSize: '1.25rem' }}>
                  Production Teacher
                </Box>
              </Group>
            </AppShell.Header>

            <AppShell.Navbar p="md">
              {/* Maybe add a small title/logo here if desired */}
              {navItems.map((item) => (
                <NavLink
                  key={item.label}
                  href={item.href}
                  label={item.label}
                  leftSection={<item.icon size="1rem" stroke={1.5} />}
                  component={Link} // Use Next.js Link for client-side routing
                  onClick={toggle} // Close navbar on mobile click
                  active={pathname === item.href} // Set active state based on path
                  variant="subtle" // Use subtle variant for better look
                  styles={{
                    root: {
                      borderRadius: 'var(--mantine-radius-sm)',
                    },
                  }}
                />
              ))}
            </AppShell.Navbar>

            <AppShell.Main>
              {/* Main content area */}
              {children} 
            </AppShell.Main>
          </AppShell>
        </MantineProvider>
      </body>
    </html>
  );
}
