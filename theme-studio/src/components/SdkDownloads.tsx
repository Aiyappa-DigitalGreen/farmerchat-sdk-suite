/* FarmerChat Theme Studio — "Get the SDK" view.
 * Per-platform, version-aware setup + downloads. For each platform it shows the
 * real install command, an expandable themed initialize()+launch snippet, a
 * download of a complete quick-start (.md), and links to the real source.
 * All SDK facts come from lib/sdk.ts (grounded in the repo); themed code comes
 * from the byte-verified export.ts generators, so nothing here drifts. */
import { useState } from "react"
import { Check, Copy, Download, ExternalLink, FileJson, Package } from "lucide-react"
import { toast } from "sonner"
import { currentCode } from "@/lib/export"
import { quickStart, SDK_META, SDK_REPO, SDK_VERSIONS, themeConfigJSON, type SdkMeta } from "@/lib/sdk"
import type { ThemeState } from "@/lib/theme"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

function saveFile(name: string, text: string, type = "text/plain") {
  const blob = new Blob([text], { type })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

function CodeBlock({ text, onCopy }: { text: string; onCopy?: () => void }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      onCopy?.()
      setTimeout(() => setCopied(false), 1400)
    })
  }
  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-lg border bg-zinc-950 p-3 pr-11 text-[0.78rem] leading-relaxed dark:bg-black">
        <code className="font-mono text-zinc-100">{text}</code>
      </pre>
      <Button type="button" size="icon" variant="ghost" onClick={copy}
        className="absolute right-1.5 top-1.5 size-7 text-zinc-400 hover:bg-white/10 hover:text-zinc-100">
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </Button>
    </div>
  )
}

function PlatformCard({ meta, state, version }: { meta: SdkMeta; state: ThemeState; version: string }) {
  const setupCode = currentCode(state, meta.id)

  function downloadQuickStart() {
    saveFile(`farmerchat-${meta.id}-v${version}-quickstart.md`, quickStart(state, meta, version), "text/markdown")
    toast.success(`Downloaded ${meta.name} quick-start`, { description: `v${version} · themed` })
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="size-4 text-muted-foreground" />{meta.name}
            </CardTitle>
            <code className="mt-1 block truncate text-xs text-muted-foreground">{meta.packageId}</code>
          </div>
          <Badge variant="secondary" className="flex-none">v{version}</Badge>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {meta.reqs.map((r) => <Badge key={r} variant="outline" className="text-[0.7rem]">{r}</Badge>)}
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-muted-foreground">Install</div>
          <CodeBlock text={meta.install(version)} onCopy={() => toast.success("Copied install command")} />
        </div>

        <Accordion type="single" collapsible>
          <AccordionItem value="setup" className="border-b-0">
            <AccordionTrigger className="py-2 text-sm">Themed setup &amp; launch code</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-muted-foreground">Initialize (your live theme)</div>
                <CodeBlock text={setupCode} onCopy={() => toast.success("Copied setup code")} />
              </div>
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-muted-foreground">Launch</div>
                <CodeBlock text={meta.usage} />
              </div>
              <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                {meta.notes.map((nt) => <li key={nt}>{nt}</li>)}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={downloadQuickStart}>
          <Download className="size-4" />Quick-start (.md)
        </Button>
        <Button type="button" size="sm" variant="outline" asChild>
          <a href={meta.source} target="_blank" rel="noreferrer">
            Source<ExternalLink className="size-3.5" />
          </a>
        </Button>
        {meta.sourceTag ? <Badge variant="outline" className="font-mono text-[0.7rem]">{meta.sourceTag(version)}</Badge> : null}
      </CardFooter>
    </Card>
  )
}

export function SdkDownloads({ state }: { state: ThemeState }) {
  const [version, setVersion] = useState<string>(SDK_VERSIONS[0])

  function downloadThemeJson() {
    saveFile("farmerchat-theme.json", themeConfigJSON(state), "application/json")
    toast.success("Downloaded theme.json")
  }

  return (
    <div className="mx-auto max-w-[1300px] px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold">Get the FarmerChat SDK</h1>
          <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground">
            Complete per-platform setup, with your live Theme Studio configuration baked into the
            <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">initialize()</code> code. Download a
            themed quick-start or grab the source.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Version</span>
            <Select value={version} onValueChange={setVersion}>
              <SelectTrigger size="sm" className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SDK_VERSIONS.map((v) => <SelectItem key={v} value={v}>v{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={downloadThemeJson}>
            <FileJson className="size-4" />theme.json
          </Button>
          <Button type="button" size="sm" variant="ghost" asChild>
            <a href={SDK_REPO} target="_blank" rel="noreferrer">
              Repo<ExternalLink className="size-3.5" />
            </a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {SDK_META.map((meta) => <PlatformCard key={meta.id} meta={meta} state={state} version={version} />)}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Only shipped versions are listed. Setup code is generated live from your theme and is byte-identical to the Export panel.
      </p>
    </div>
  )
}
