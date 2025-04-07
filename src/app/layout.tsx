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
        <div className="hidden space-y-6 p-10 pb-16 md:block">
          <div className="space-y-0.5">
            <h2 className="text-2xl font-bold tracking-tight">Production Teacher</h2>
            <p className="text-muted-foreground">
              Analyze content and manage your reports.
            </p>
          </div>
          <Separator className="my-6" />
          <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
            <aside className="-mx-4 lg:w-1/5">
              <SidebarNav items={sidebarNavItems} />
            </aside>
            <div className="flex-1 lg:max-w-4xl">{children}</div> 
          </div>
        </div>
        
        {/* Simple layout for mobile (can be enhanced later) */}
        <div className="md:hidden p-4">
          <h2 className="text-xl font-bold tracking-tight mb-4">Production Teacher</h2>
          {children}
        </div>
        
        <Toaster />
      </body>
    </html>
  );
}
