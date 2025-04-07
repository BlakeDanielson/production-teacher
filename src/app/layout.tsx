import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SidebarNav } from "@/components/SidebarNav"; 
import { Separator } from "@/components/ui/separator";
import { Youtube, FileCheck, BarChart, Settings } from 'lucide-react'; // Import icons

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-sans"
});

export const metadata: Metadata = {
  title: "Production Teacher",
  description: "AI-powered analysis for video creators",
};

// Sidebar navigation items
const sidebarNavItems = [
  {
    title: "YouTube Analysis",
    href: "/", 
    icon: <Youtube size={18} />
  },
  {
    title: "Transcription",
    href: "/transcription", // We'll need to move transcription logic later
    icon: <FileCheck size={18} />
  },
  {
    title: "Reports",
    href: "/reports", // We'll need to move reports logic later
    icon: <BarChart size={18} />
  },
  {
    title: "Settings",
    href: "/settings",
    icon: <Settings size={18} />
  },
]

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans`}>
        <div className="container mx-auto p-4 md:p-10">
          {/* Header for all screen sizes */}
          <div className="space-y-0.5 mb-6">
            <h2 className="text-2xl font-bold tracking-tight">Production Teacher</h2>
            <p className="text-muted-foreground">
              Analyze content and manage your reports.
            </p>
          </div>
          <Separator className="mb-6" />

          {/* Main layout with sidebar for larger screens */}
          <div className="flex flex-col lg:flex-row lg:space-x-12">
            {/* Sidebar - hidden on small screens, shown on lg and up */}
            <aside className="hidden lg:block lg:w-1/5 mb-6 lg:mb-0">
              <SidebarNav items={sidebarNavItems} />
            </aside>

            {/* Main content area - renders children ONCE */}
            <main className="flex-1">
              {children} 
            </main>
          </div>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
