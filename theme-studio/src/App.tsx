/* FarmerChat Theme Studio — app shell. Studio chrome is shadcn/ui; the phone is
 * a faithful SDK re-render (see PhonePreview). Precedence honored end-to-end:
 * config knob ?? theme token ?? built-in default. */
import { useState } from "react"
import { Moon, RotateCcw, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { clone, DEFAULT_PRESET, PRESETS, type PlatformId, type ThemeState } from "@/lib/theme"
import { Logo } from "@/components/Logo"
import { Controls } from "@/components/Controls"
import { ExportPanel } from "@/components/ExportPanel"
import { Gallery } from "@/components/Gallery"
import { SdkDownloads } from "@/components/SdkDownloads"
import { PhonePreview, SCREENS, type Appearance, type Screen } from "@/components/PhonePreview"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

function StudioThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" onClick={() => setTheme(isDark ? "light" : "dark")} aria-label="Toggle studio theme">
          {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Studio appearance ({isDark ? "dark" : "light"})</TooltipContent>
    </Tooltip>
  )
}

type View = "studio" | "gallery" | "sdk"

/** Read an initial value from the URL query (shareable deep-links), validated. */
function fromUrl<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const v = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get(key) : null
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
}

export default function App() {
  const [view, setView] = useState<View>(() => fromUrl("view", ["studio", "gallery", "sdk"], "studio"))
  const [activePreset, setActivePreset] = useState(DEFAULT_PRESET)
  const [state, setState] = useState<ThemeState>(() => clone(PRESETS[DEFAULT_PRESET].values))
  const [platform, setPlatform] = useState<PlatformId>("web")
  const [appearance, setAppearance] = useState<Appearance>(() => fromUrl("appearance", ["day", "night"], "day"))
  const [screen, setScreen] = useState<Screen>(() => fromUrl("screen", SCREENS.map(([id]) => id), "home"))

  function selectPreset(name: string) {
    setActivePreset(name)
    setState(clone(PRESETS[name].values))
  }
  function reset() {
    setActivePreset(DEFAULT_PRESET)
    setState(clone(PRESETS[DEFAULT_PRESET].values))
    setAppearance("day")
    setScreen("home")
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b bg-card/80 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <Logo size={24} className="text-primary" />
          <span className="text-[1.05rem]">FarmerChat <b className="font-extrabold">Theme Studio</b></span>
          <Tabs value={view} onValueChange={(v) => setView(v as View)} className="ml-2">
            <TabsList>
              <TabsTrigger value="studio">Studio</TabsTrigger>
              {/* Gallery tab hidden on request. The route still works via
                  ?view=gallery — restore this trigger to bring the tab back. */}
              <TabsTrigger value="sdk">Get SDK</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-2">
          {view === "studio" && (
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-muted-foreground sm:inline">Preview</span>
              <Select value={appearance} onValueChange={(v) => setAppearance(v as Appearance)}>
                <SelectTrigger size="sm" className="w-[92px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Light</SelectItem>
                  <SelectItem value="night">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <StudioThemeToggle />
          {view === "studio" && (
            <Button variant="outline" size="sm" onClick={reset}><RotateCcw className="h-4 w-4" />Reset</Button>
          )}
        </div>
      </header>

      {view === "gallery" ? (
        <Gallery />
      ) : view === "sdk" ? (
        <SdkDownloads />
      ) : (
      <main className="mx-auto grid max-w-[1500px] grid-cols-1 items-start gap-6 p-4 lg:grid-cols-[360px_1fr] lg:p-6">
        <aside className="lg:sticky lg:top-[73px] lg:max-h-[calc(100vh-89px)] lg:overflow-y-auto lg:pr-1 lg:pb-10">
          <Controls state={state} activePreset={activePreset} onPreset={selectPreset} onChange={setState} />
        </aside>

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(320px,400px)_1fr]">
          <section className="flex flex-col items-center">
            <Tabs value={screen} onValueChange={(v) => setScreen(v as Screen)} className="mb-3 w-full">
              <TabsList style={{ height: "auto" }} className="grid w-full grid-cols-3 gap-1">
                {SCREENS.map(([id, name]) => <TabsTrigger key={id} value={id} className="h-8">{name}</TabsTrigger>)}
              </TabsList>
            </Tabs>
            <p className="mb-3 max-w-[46ch] text-center text-xs text-muted-foreground">
              Approximate shared design — the SDK renders consistently across platforms. The platform tabs change the exported code, not this preview.
            </p>
            <PhonePreview theme={state} appearance={appearance} setAppearance={setAppearance} screen={screen} setScreen={setScreen} />
          </section>

          <ExportPanel state={state} platform={platform} setPlatform={setPlatform} />
        </div>
      </main>
      )}
    </div>
  )
}
