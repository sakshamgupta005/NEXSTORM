import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function ProjectPlaceholder() {
  const extensionPoints = [
    {
      title: '1. Domain Data Models',
      description: 'Define schema and tables in Supabase SQL editor or migrations.',
      path: 'src/lib/supabase/',
    },
    {
      title: '2. Product Components',
      description: 'Build your feature UI and interactive panels.',
      path: 'src/components/',
    },
    {
      title: '3. Server Handlers & APIs',
      description: 'Add API routes or Server Actions for AI pipelines and third-party APIs.',
      path: 'src/app/api/ or src/app/actions/',
    },
  ]

  return (
    <div className="space-y-4">
      <Card className="border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Product Workspace Extension Point
          </CardTitle>
          <CardDescription className="text-xs">
            This protected shell verifies authentication, sessions, and responsive navigation.
            When implementing your hackathon challenge, replace this placeholder with your actual product experience.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {extensionPoints.map((item) => (
              <div
                key={item.title}
                className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"
              >
                <h4 className="text-xs font-semibold mb-1">{item.title}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
                  {item.description}
                </p>
                <div className="text-[10px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded inline-block">
                  {item.path}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
