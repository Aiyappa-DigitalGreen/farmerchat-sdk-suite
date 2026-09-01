/* FarmerChat Theme Studio — component gallery.
 * A live catalogue of every installed shadcn/ui primitive, rendered with the
 * studio's current theme tokens (light/dark via next-themes). This is a preview
 * surface, not shipped SDK code — it exists so you can eyeball how each control
 * looks under a given theme before exporting a FarmerChatConfig. */
import { useState } from "react"
import {
  Bold, Italic, Underline, Check, ChevronRight, Search, Star, Terminal,
  Calendar as CalendarIcon, CreditCard, Settings, User,
} from "lucide-react"
import { toast } from "sonner"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter,
  DrawerHeader, DrawerTitle, DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@/components/ui/empty"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader,
  SheetTitle, SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/* ── Scaffold ─────────────────────────────────────────────────────────────
 * Every demo is wrapped in a titled cell. The gallery is a responsive grid of
 * these cells, grouped under section headings that also serve as jump targets. */
type Category = { id: string; label: string }

const CATEGORIES: Category[] = [
  { id: "actions", label: "Actions" },
  { id: "forms", label: "Form controls" },
  { id: "display", label: "Data display" },
  { id: "overlays", label: "Overlays & menus" },
  { id: "navigation", label: "Navigation" },
  { id: "feedback", label: "Feedback & status" },
  { id: "layout", label: "Layout" },
]

function Demo({ title, span, children }: { title: string; span?: boolean; children: React.ReactNode }) {
  return (
    <div className={span ? "sm:col-span-2 xl:col-span-3" : ""}>
      <div className="flex h-full flex-col rounded-lg border bg-card">
        <div className="border-b px-3 py-2">
          <code className="text-xs font-medium text-muted-foreground">{title}</code>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-3 p-4">{children}</div>
      </div>
    </div>
  )
}

function Section({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{label}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  )
}

// Chat-family + layout primitives that need full-page context, not a card cell.
const NOT_DEMOED = [
  "sidebar", "combobox", "resizable", "chart", "menubar", "navigation-menu",
  "carousel", "field", "bubble", "message", "message-scroller", "marker",
  "attachment", "direction",
]

export function Gallery() {
  const [progress] = useState(66)

  return (
    <div className="mx-auto max-w-[1300px] px-4 py-6 lg:px-6">
      {/* Category jump-nav */}
      <div className="sticky top-[73px] z-10 mb-6 -mx-4 flex flex-wrap gap-1.5 border-b bg-background/80 px-4 py-2 backdrop-blur lg:-mx-6 lg:px-6">
        {CATEGORIES.map((c) => (
          <a key={c.id} href={`#${c.id}`}>
            <Badge variant="secondary" className="cursor-pointer hover:bg-accent">{c.label}</Badge>
          </a>
        ))}
      </div>

      <div className="space-y-10">
        {/* ── Actions ── */}
        <Section id="actions" label="Actions">
          <Demo title="Button">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button disabled>Disabled</Button>
          </Demo>
          <Demo title="Button + Group">
            <ButtonGroup>
              <Button variant="outline">Day</Button>
              <Button variant="outline">Week</Button>
              <Button variant="outline">Month</Button>
            </ButtonGroup>
          </Demo>
          <Demo title="Toggle / ToggleGroup">
            <Toggle aria-label="Star"><Star className="h-4 w-4" /></Toggle>
            <ToggleGroup type="multiple" variant="outline">
              <ToggleGroupItem value="bold" aria-label="Bold"><Bold className="h-4 w-4" /></ToggleGroupItem>
              <ToggleGroupItem value="italic" aria-label="Italic"><Italic className="h-4 w-4" /></ToggleGroupItem>
              <ToggleGroupItem value="underline" aria-label="Underline"><Underline className="h-4 w-4" /></ToggleGroupItem>
            </ToggleGroup>
          </Demo>
        </Section>

        {/* ── Form controls ── */}
        <Section id="forms" label="Form controls">
          <Demo title="Input + Label">
            <div className="grid w-full gap-1.5">
              <Label htmlFor="g-email">Email</Label>
              <Input id="g-email" type="email" placeholder="farmer@example.com" />
            </div>
          </Demo>
          <Demo title="InputGroup">
            <InputGroup>
              <InputGroupAddon><Search className="h-4 w-4" /></InputGroupAddon>
              <InputGroupInput placeholder="Search crops…" />
            </InputGroup>
          </Demo>
          <Demo title="Textarea">
            <Textarea placeholder="Ask a question…" className="w-full" />
          </Demo>
          <Demo title="Select">
            <Select>
              <SelectTrigger className="w-full"><SelectValue placeholder="Choose a crop" /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Cereals</SelectLabel>
                  <SelectItem value="rice">Rice</SelectItem>
                  <SelectItem value="wheat">Wheat</SelectItem>
                  <SelectItem value="maize">Maize</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Demo>
          <Demo title="NativeSelect">
            <NativeSelect defaultValue="en">
              <NativeSelectOption value="en">English</NativeSelectOption>
              <NativeSelectOption value="hi">Hindi</NativeSelectOption>
              <NativeSelectOption value="sw">Swahili</NativeSelectOption>
            </NativeSelect>
          </Demo>
          <Demo title="Checkbox">
            <div className="flex items-center gap-2">
              <Checkbox id="g-terms" defaultChecked />
              <Label htmlFor="g-terms">Accept terms</Label>
            </div>
          </Demo>
          <Demo title="RadioGroup">
            <RadioGroup defaultValue="sms" className="gap-2">
              <div className="flex items-center gap-2"><RadioGroupItem value="sms" id="g-sms" /><Label htmlFor="g-sms">SMS</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="wa" id="g-wa" /><Label htmlFor="g-wa">WhatsApp</Label></div>
            </RadioGroup>
          </Demo>
          <Demo title="Switch">
            <div className="flex items-center gap-2">
              <Switch id="g-voice" defaultChecked />
              <Label htmlFor="g-voice">Voice replies</Label>
            </div>
          </Demo>
          <Demo title="Slider">
            <Slider defaultValue={[60]} max={100} step={1} className="w-full" />
          </Demo>
          <Demo title="InputOTP">
            <InputOTP maxLength={4}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
              </InputOTPGroup>
            </InputOTP>
          </Demo>
        </Section>

        {/* ── Data display ── */}
        <Section id="display" label="Data display">
          <Demo title="Badge">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
          </Demo>
          <Demo title="Avatar">
            <Avatar><AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" /><AvatarFallback>CN</AvatarFallback></Avatar>
            <Avatar className="h-12 w-12"><AvatarFallback>FC</AvatarFallback></Avatar>
          </Demo>
          <Demo title="Kbd">
            <KbdGroup>
              <Kbd>⌘</Kbd><Kbd>K</Kbd>
            </KbdGroup>
          </Demo>
          <Demo title="Card">
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Season summary</CardTitle>
                <CardDescription>Kharif 2026</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">Yield up 12% vs last season.</CardContent>
              <CardFooter><Button size="sm">View</Button></CardFooter>
            </Card>
          </Demo>
          <Demo title="Item">
            <Item className="w-full">
              <ItemMedia><Avatar><AvatarFallback>RK</AvatarFallback></Avatar></ItemMedia>
              <ItemContent>
                <ItemTitle>Ramesh Kumar</ItemTitle>
                <ItemDescription>Last active 2h ago</ItemDescription>
              </ItemContent>
            </Item>
          </Demo>
          <Demo title="Table" span>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Crop</TableHead><TableHead>Area</TableHead><TableHead className="text-right">Yield</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                <TableRow><TableCell>Rice</TableCell><TableCell>2.4 ha</TableCell><TableCell className="text-right">5.1 t</TableCell></TableRow>
                <TableRow><TableCell>Wheat</TableCell><TableCell>1.8 ha</TableCell><TableCell className="text-right">3.7 t</TableCell></TableRow>
              </TableBody>
            </Table>
          </Demo>
          <Demo title="Calendar">
            <Calendar mode="single" className="rounded-md border" />
          </Demo>
        </Section>

        {/* ── Overlays & menus ── */}
        <Section id="overlays" label="Overlays & menus">
          <Demo title="Dialog">
            <Dialog>
              <DialogTrigger asChild><Button variant="outline">Open dialog</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit profile</DialogTitle>
                  <DialogDescription>Make changes and save.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-1.5"><Label htmlFor="g-name">Name</Label><Input id="g-name" defaultValue="Ramesh" /></div>
                <DialogFooter><Button>Save</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </Demo>
          <Demo title="AlertDialog">
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="destructive">Delete</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction>Continue</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Demo>
          <Demo title="Sheet">
            <Sheet>
              <SheetTrigger asChild><Button variant="outline">Open sheet</Button></SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                  <SheetDescription>Refine the crop list.</SheetDescription>
                </SheetHeader>
                <SheetFooter><SheetClose asChild><Button>Apply</Button></SheetClose></SheetFooter>
              </SheetContent>
            </Sheet>
          </Demo>
          <Demo title="Drawer">
            <Drawer>
              <DrawerTrigger asChild><Button variant="outline">Open drawer</Button></DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>Confirm location</DrawerTitle>
                  <DrawerDescription>We use this for weather advice.</DrawerDescription>
                </DrawerHeader>
                <DrawerFooter><DrawerClose asChild><Button>Done</Button></DrawerClose></DrawerFooter>
              </DrawerContent>
            </Drawer>
          </Demo>
          <Demo title="Popover">
            <Popover>
              <PopoverTrigger asChild><Button variant="outline">Open popover</Button></PopoverTrigger>
              <PopoverContent className="text-sm">Dimensions and settings live here.</PopoverContent>
            </Popover>
          </Demo>
          <Demo title="HoverCard">
            <HoverCard>
              <HoverCardTrigger asChild><Button variant="link">@digitalgreen</Button></HoverCardTrigger>
              <HoverCardContent className="text-sm">Non-profit building AI tools for smallholder farmers.</HoverCardContent>
            </HoverCard>
          </Demo>
          <Demo title="Tooltip">
            <Tooltip>
              <TooltipTrigger asChild><Button variant="outline">Hover me</Button></TooltipTrigger>
              <TooltipContent>Helpful hint</TooltipContent>
            </Tooltip>
          </Demo>
          <Demo title="DropdownMenu">
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline">Account</Button></DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>My account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem><User className="h-4 w-4" />Profile</DropdownMenuItem>
                <DropdownMenuItem><CreditCard className="h-4 w-4" />Billing</DropdownMenuItem>
                <DropdownMenuItem><Settings className="h-4 w-4" />Settings</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Demo>
          <Demo title="ContextMenu">
            <ContextMenu>
              <ContextMenuTrigger className="flex h-16 w-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                Right-click here
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem>Back</ContextMenuItem>
                <ContextMenuItem>Reload</ContextMenuItem>
                <ContextMenuItem>Save as…</ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </Demo>
          <Demo title="Command" span>
            <Command className="rounded-lg border shadow-sm">
              <CommandInput placeholder="Type a command…" />
              <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup heading="Suggestions">
                  <CommandItem><CalendarIcon className="h-4 w-4" />Calendar</CommandItem>
                  <CommandItem><Search className="h-4 w-4" />Search crops</CommandItem>
                  <CommandItem><Settings className="h-4 w-4" />Settings</CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </Demo>
        </Section>

        {/* ── Navigation ── */}
        <Section id="navigation" label="Navigation">
          <Demo title="Tabs">
            <Tabs defaultValue="account" className="w-full">
              <TabsList>
                <TabsTrigger value="account">Account</TabsTrigger>
                <TabsTrigger value="password">Password</TabsTrigger>
              </TabsList>
              <TabsContent value="account" className="pt-2 text-sm text-muted-foreground">Account settings.</TabsContent>
              <TabsContent value="password" className="pt-2 text-sm text-muted-foreground">Change your password.</TabsContent>
            </Tabs>
          </Demo>
          <Demo title="Accordion">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="a">
                <AccordionTrigger>Is it accessible?</AccordionTrigger>
                <AccordionContent>Yes. It follows WAI-ARIA patterns.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="b">
                <AccordionTrigger>Is it themed?</AccordionTrigger>
                <AccordionContent>Yes — it uses your studio tokens.</AccordionContent>
              </AccordionItem>
            </Accordion>
          </Demo>
          <Demo title="Breadcrumb">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem><BreadcrumbLink href="#">Home</BreadcrumbLink></BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem><BreadcrumbLink href="#">Crops</BreadcrumbLink></BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem><BreadcrumbPage>Rice</BreadcrumbPage></BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </Demo>
          <Demo title="Pagination">
            <Pagination>
              <PaginationContent>
                <PaginationItem><PaginationPrevious href="#" /></PaginationItem>
                <PaginationItem><PaginationLink href="#" isActive>1</PaginationLink></PaginationItem>
                <PaginationItem><PaginationLink href="#">2</PaginationLink></PaginationItem>
                <PaginationItem><PaginationNext href="#" /></PaginationItem>
              </PaginationContent>
            </Pagination>
          </Demo>
          <Demo title="Collapsible">
            <Collapsible className="w-full">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between">Advanced options <ChevronRight className="h-4 w-4" /></Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 text-sm text-muted-foreground">Extra settings revealed here.</CollapsibleContent>
            </Collapsible>
          </Demo>
        </Section>

        {/* ── Feedback & status ── */}
        <Section id="feedback" label="Feedback & status">
          <Demo title="Alert">
            <Alert>
              <Terminal className="h-4 w-4" />
              <AlertTitle>Heads up!</AlertTitle>
              <AlertDescription>Your session token was refreshed.</AlertDescription>
            </Alert>
          </Demo>
          <Demo title="Sonner (toast)">
            <Button variant="outline" onClick={() => toast.success("Config exported", { description: "Copied to clipboard." })}>
              Show toast
            </Button>
          </Demo>
          <Demo title="Progress">
            <Progress value={progress} className="w-full" />
          </Demo>
          <Demo title="Spinner">
            <Spinner /><span className="text-sm text-muted-foreground">Loading…</span>
          </Demo>
          <Demo title="Skeleton">
            <div className="flex w-full items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>
            </div>
          </Demo>
          <Demo title="Empty">
            <Empty className="w-full">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Search className="h-5 w-5" /></EmptyMedia>
                <EmptyTitle>No results</EmptyTitle>
                <EmptyDescription>Try a different search term.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent><Button size="sm" variant="outline">Clear filters</Button></EmptyContent>
            </Empty>
          </Demo>
        </Section>

        {/* ── Layout ── */}
        <Section id="layout" label="Layout">
          <Demo title="Separator">
            <div className="w-full">
              <div className="text-sm">Section A</div>
              <Separator className="my-2" />
              <div className="text-sm">Section B</div>
            </div>
          </Demo>
          <Demo title="AspectRatio">
            <div className="w-full">
              <AspectRatio ratio={16 / 9} className="rounded-md bg-muted">
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">16 : 9</div>
              </AspectRatio>
            </div>
          </Demo>
          <Demo title="ScrollArea">
            <ScrollArea className="h-32 w-full rounded-md border p-3">
              <div className="space-y-2 text-sm">
                {Array.from({ length: 12 }, (_, i) => <div key={i}>Scrollable row {i + 1}</div>)}
              </div>
            </ScrollArea>
          </Demo>
        </Section>

        {/* Installed but not demoed (need full-page context or custom data) */}
        <section className="rounded-lg border border-dashed p-4">
          <h2 className="mb-1 text-sm font-semibold">Installed, not demoed here</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            These need a full-page shell or bespoke data, so they're best previewed in context rather than a card cell. All are present in <code>src/components/ui</code> and ready to import.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {NOT_DEMOED.map((n) => <Badge key={n} variant="outline"><Check className="mr-1 h-3 w-3" />{n}</Badge>)}
          </div>
        </section>
      </div>
    </div>
  )
}
