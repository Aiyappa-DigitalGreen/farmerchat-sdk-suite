/* Studio controls — built from shadcn/ui primitives (Card, Label, Input, Slider,
 * Switch, Separator, Badge, Button, Tooltip). The field set is FROZEN to the
 * SDK's shipped, overridable surface (see src/lib/theme.ts). */
import { Ban } from "lucide-react"
import {
  CHAT_COLORS, COLORS, CONFIG_DEFAULTS, FAB_COLORS, NIGHT_COLORS, PRESETS, SHAPE,
  type Chat, type Colors, type Config, type Fab, type NightColors, type NumOrEmpty, type Shape, type ThemeState, type Typography,
} from "@/lib/theme"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface Props {
  state: ThemeState
  activePreset: string
  onPreset: (name: string) => void
  onChange: (next: ThemeState) => void
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/

export function Controls({ state, activePreset, onPreset, onChange }: Props) {
  function patch<K extends keyof ThemeState>(section: K, value: Partial<ThemeState[K]>) {
    onChange({ ...state, [section]: { ...state[section], ...value } })
  }

  /* --- runtime config rows. `cfg` falls back to the SDK defaults so a theme
        saved before this section existed still renders. ------------------- */
  const cfg: Config = state.config ?? CONFIG_DEFAULTS
  const setCfg = (k: keyof Config, v: string | boolean) =>
    onChange({ ...state, config: { ...cfg, [k]: v } })

  const SelectRow = (key: keyof Config, label: string, opts: string[]) => (
    <div className="flex items-center justify-between gap-3 py-1.5" key={String(key)}>
      <Label className="text-sm font-normal">{label}</Label>
      <Select value={String(cfg[key])} onValueChange={(v) => setCfg(key, v)}>
        <SelectTrigger size="sm" className="w-[150px]" data-testid={`config-${String(key)}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {opts.map((o) => <SelectItem key={o} value={o} className="font-mono text-xs">{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )

  const ConfigTextRow = (key: keyof Config, label: string, hint?: string) => (
    <div className="flex items-center justify-between gap-3 py-1.5" key={String(key)}>
      <div className="min-w-0">
        <Label className="text-sm font-normal">{label}</Label>
        {hint && <span className="block text-[0.7rem] text-muted-foreground">{hint}</span>}
      </div>
      <Input
        value={String(cfg[key] ?? "")}
        placeholder="unset"
        onChange={(e) => setCfg(key, e.target.value)}
        className="h-7 w-[150px] font-mono text-xs"
        data-testid={`config-${String(key)}`}
      />
    </div>
  )

  const SwitchRow = (key: keyof Config, label: string, hint?: string) => {
    const on = Boolean(cfg[key])
    const isDefault = cfg[key] === CONFIG_DEFAULTS[key]
    return (
      <div className="flex items-center justify-between gap-3 py-1.5" key={String(key)}>
        <div className="min-w-0">
          <Label className="text-sm font-normal">{label}</Label>
          {hint
            ? <span className="block text-[0.7rem] text-muted-foreground">{hint}</span>
            : !isDefault && <span className="block text-[0.7rem] text-muted-foreground">differs from SDK default</span>}
        </div>
        <Switch checked={on} onCheckedChange={(v) => setCfg(key, v)} data-testid={`config-${String(key)}`} />
      </div>
    )
  }

  const ColorRow = <T extends Colors | Fab | Chat | NightColors>(
    section: "colors" | "fab" | "chat" | "night", obj: T, key: keyof T, label: string, optional = false,
  ) => {
    const val = (obj[key] as unknown as string) || ""
    return (
      <div className="flex items-center justify-between gap-3 py-1.5" key={String(key)}>
        <div className="min-w-0">
          <Label className="text-sm font-normal">{label}</Label>
          {optional && <span className="block text-[0.7rem] text-muted-foreground">empty = inherit</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={HEX_RE.test(val) ? val : "#888888"}
            onChange={(e) => patch(section, { [key]: e.target.value.toUpperCase() } as Partial<ThemeState[typeof section]>)}
            className="h-7 w-8 cursor-pointer rounded-md border border-input bg-transparent p-0"
            aria-label={label}
          />
          <Input
            value={val}
            placeholder={optional ? "inherit" : "#RRGGBB"}
            onChange={(e) => patch(section, { [key]: e.target.value.trim() } as Partial<ThemeState[typeof section]>)}
            className="h-7 w-[86px] font-mono text-xs"
            data-testid={`${section}-${String(key)}`}
          />
          {optional && val && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"
                  onClick={() => patch(section, { [key]: "" } as Partial<ThemeState[typeof section]>)}>
                  <Ban className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear (inherit theme/default)</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    )
  }

  const SliderRow = (
    section: "shape" | "typography" | "chat", key: string, label: string,
    value: number, min: number, max: number, step: number, suffix: string,
    onSet: (v: number) => void,
  ) => (
    <div className="py-1.5" key={`${section}.${key}`}>
      <div className="mb-1.5 flex items-center justify-between">
        <Label className="text-sm font-normal">{label}</Label>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{value}{suffix}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onSet(v)} />
    </div>
  )

  // Gated (optional) slider — Switch toggles between "inherit" ("") and a value.
  const GatedSliderRow = (
    key: keyof Chat, label: string, fallback: number, min: number, max: number, step: number, suffix: string,
  ) => {
    const raw = state.chat[key] as NumOrEmpty
    const on = raw !== ""
    const value = on ? (raw as number) : fallback
    return (
      <div className="py-1.5" key={String(key)}>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <Label className="text-sm font-normal">{label}</Label>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{on ? `${value}${suffix}` : "inherit"}</span>
            <Switch checked={on} onCheckedChange={(c) => patch("chat", { [key]: c ? fallback : "" } as Partial<Chat>)} aria-label={`Override ${label}`} />
          </div>
        </div>
        <Slider value={[value]} min={min} max={max} step={step} disabled={!on}
          onValueChange={([v]) => patch("chat", { [key]: v } as Partial<Chat>)} />
      </div>
    )
  }

  const TextRow = (
    section: "typography" | "fab", key: string, label: string, value: string, placeholder: string,
  ) => (
    <div className="flex items-center justify-between gap-3 py-1.5" key={`${section}.${key}`}>
      <Label className="text-sm font-normal">{label}</Label>
      <Input value={value} placeholder={placeholder} className="h-8 w-[150px] text-sm"
        onChange={(e) => patch(section, { [key]: e.target.value } as never)} />
    </div>
  )

  const num = (v: NumOrEmpty, d: number) => (v === "" ? d : v)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Preset theme</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {Object.keys(PRESETS).map((name) => (
            <Button key={name} type="button" size="sm"
              variant={name === activePreset ? "default" : "outline"}
              className="h-8 rounded-full px-3 text-xs font-normal"
              onClick={() => onPreset(name)}>
              <span className="mr-1.5 inline-block h-3 w-3 rounded-sm" style={{ background: PRESETS[name].sw }} />
              {name}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Brand colors</CardTitle></CardHeader>
        <CardContent className="pt-0">
          {COLORS.map(([k, l]) => ColorRow("colors", state.colors, k, l))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Dark mode colors
          </CardTitle>
          <p className="text-[0.7rem] leading-snug text-muted-foreground">
            Optional. Leave a swatch empty and the SDK reuses the light colour for dark mode.
            Switch the phone preview to night to see these.
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          {NIGHT_COLORS.map(([k, l]) => ColorRow("night", state.night, k, l, true))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Shape (radius)</CardTitle></CardHeader>
        <CardContent className="pt-0">
          {SHAPE.map(([k, l]) => SliderRow("shape", k, l, num(state.shape[k], 0) as number, 0, 64, 1, "px",
            (v) => patch("shape", { [k]: v } as Partial<Shape>)))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Typography</CardTitle></CardHeader>
        <CardContent className="pt-0">
          {SliderRow("typography", "typeScale", "Type scale", num(state.typography.typeScale, 1) as number, 0.8, 1.6, 0.05, "×",
            (v) => patch("typography", { typeScale: v } as Partial<Typography>))}
          <Separator className="my-2" />
          {TextRow("typography", "fontFamily", "Font family", state.typography.fontFamily, "e.g. Inter")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Floating button (FAB)</CardTitle></CardHeader>
        <CardContent className="pt-0">
          {TextRow("fab", "fabLabel", "FAB label", state.fab.fabLabel, "empty = round")}
          <Separator className="my-2" />
          {FAB_COLORS.map(([k, l]) => ColorRow("fab", state.fab, k, l, true))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Chat message UI</CardTitle></CardHeader>
        <CardContent className="pt-0">
          {CHAT_COLORS.map(([k, l]) => ColorRow("chat", state.chat, k, l, true))}
          <Separator className="my-2" />
          {GatedSliderRow("bubbleCornerRadius", "Bubble radius", 20, 0, 64, 1, "px")}
          {GatedSliderRow("messageFontSize", "Message font size", 15, 10, 40, 1, "px")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Environment &amp; identity</CardTitle></CardHeader>
        <CardContent className="pt-0">
          {SelectRow("environment", "Environment", ["DEV", "STAGE", "DEMO", "PROD", "EKS"])}
          <Separator className="my-2" />
          {ConfigTextRow("guestApiKey", "Guest API key", "required for anonymous sessions")}
          {ConfigTextRow("geoApiKey", "Google geo key", "advice feed stays empty without it")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Journey &amp; locale</CardTitle></CardHeader>
        <CardContent className="pt-0">
          {SelectRow("mode", "Mode", ["FULL_JOURNEY", "CHAT_ONLY"])}
          {SelectRow("appearance", "Appearance", ["DAY", "NIGHT", "AUTO"])}
          <Separator className="my-2" />
          {ConfigTextRow("languageCode", "Language code", 'e.g. "en", "hi"')}
          {ConfigTextRow("defaultCountryCode", "Country code", 'e.g. "IN", "KE"')}
          {ConfigTextRow("defaultStateCode", "State code", "seed geography")}
          <Separator className="my-2" />
          {SwitchRow("showDrawer", "Show drawer")}
          {SwitchRow("showHistory", "Show chat history")}
          {SwitchRow("showSettings", "Show settings")}
          {SwitchRow("showNameScreen", "Show name screen")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Features</CardTitle></CardHeader>
        <CardContent className="pt-0">
          {SwitchRow("enableVoice", "Voice questions")}
          {SwitchRow("enableImages", "Photo questions")}
          {SwitchRow("enableWeather", "Weather")}
          {SwitchRow("enableSsfr", "SSFR advisory")}
          <Separator className="my-2" />
          {SwitchRow("enableAgenticChat", "Agentic streaming chat", "2.0.0 opt-in")}
          {SwitchRow("enableAnalytics", "Analytics events", "off by default; hooks fire regardless")}
        </CardContent>
      </Card>
    </div>
  )
}
