/* Export panel — platform picker (shadcn Tabs) + generated code (ScrollArea) +
 * copy / download actions (Button + sonner toasts). Code generation is delegated
 * to src/lib/export.ts, which is byte-verified against the SDK. */
import { Copy, Download, FileJson } from "lucide-react"
import { toast } from "sonner"
import { currentCode, EXT, FOOT, themeJSON } from "@/lib/export"
import { PLATFORMS, type PlatformId, type ThemeState } from "@/lib/theme"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Props {
  state: ThemeState
  platform: PlatformId
  setPlatform: (p: PlatformId) => void
}

function download(name: string, text: string, type = "text/plain") {
  const blob = new Blob([text], { type })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function ExportPanel({ state, platform, setPlatform }: Props) {
  const code = currentCode(state, platform)
  const platformName = PLATFORMS.find(([id]) => id === platform)![1]

  function copy() {
    navigator.clipboard.writeText(code)
      .then(() => toast.success(`Copied ${platformName} config`))
      .catch(() => toast.error("Copy failed"))
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Export — {platformName}</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={copy}><Copy className="h-4 w-4" />Copy code</Button>
            <Button size="sm" variant="outline" onClick={() => { download(`farmerchat-theme.${EXT[platform]}`, code); toast.success("Downloaded snippet") }}>
              <Download className="h-4 w-4" />Snippet
            </Button>
            <Button size="sm" variant="outline" onClick={() => { download("farmerchat-theme.json", themeJSON(state), "application/json"); toast.success("Downloaded theme.json") }}>
              <FileJson className="h-4 w-4" />theme.json
            </Button>
          </div>
        </div>
        <Tabs value={platform} onValueChange={(v) => setPlatform(v as PlatformId)}>
          <TabsList>
            {PLATFORMS.map(([id, name]) => (
              <TabsTrigger key={id} value={id}>{name}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="space-y-3">
        <ScrollArea className="max-h-[520px] rounded-lg border bg-zinc-950 dark:bg-black">
          <pre className="p-4 text-[0.8rem] leading-relaxed"><code className="font-mono text-zinc-100">{code}</code></pre>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        <p className="text-xs text-muted-foreground">{FOOT[platform]}</p>
      </CardContent>
    </Card>
  )
}
