package org.digitalgreen.farmerchat.sdk.views

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Pins the app-parity invariants this flavour was measured into.
 *
 * ## Why a resource test and not a screenshot test
 *
 * Every number in `docs/04-parity-matrix.md` came from diffing this flavour against the real
 * FarmerChat app on an emulator, with both pointed at the same backend and the same language.
 * That is not reproducible in CI — it needs the reference APK, a booted AVD, network, and a
 * matching served-label set. So the golden-image approach cannot guard this work.
 *
 * What CAN be guarded is the **cause** of almost every defect that was found: a wrong resource
 * value. The app-bar glow, the appearance-tile geometry, the mode icons, the drawer's palette,
 * the selected-row colour, the fixed row heights, the screen padding rhythm — each was a value in
 * an XML file, and each is asserted here. If someone changes one, this fails on the JVM in
 * milliseconds and names the measurement it violates.
 *
 * ## The one behavioural invariant
 *
 * [recycledRowsMustNotUseFcText] encodes a PERFORMANCE decision, not an appearance one. `FcText`
 * is a composition host; measured in a recycled row it took the 99th-percentile frame from 24ms
 * to 73ms — four times the budget. That trade-off is easy to undo by accident, so it is a test.
 */
class ViewsAppParityTest {

    // Gradle runs unit tests with the module directory as the working directory.
    private val res = File("src/main/res")

    private fun layout(name: String) = File(res, "layout/$name.xml").readText()
    private fun values(name: String) = File(res, "values/$name.xml").readText()

    // ── app bar ────────────────────────────────────────────────────────────────────────────

    /**
     * The app draws its sunbeam glow on HOME ONLY — its Settings passes `showGlow = false`, and
     * the bar measures flat #008236 there. Views showed it on every screen, which made the app
     * bar the single largest pixel difference on Settings: 37,180px, 32% of the screen.
     */
    @Test
    fun `app bar glow is hidden by default`() {
        val bar = layout("fc_view_appbar")
        val glow = bar.substringAfter("@+id/fcAppBarGlow").substringBefore("/>")
        assertTrue(
            "fcAppBarGlow must default to gone — only HomeFragment turns it on. " +
                "Showing it everywhere cost 37,180 differing pixels on Settings alone.",
            glow.contains("""android:visibility="gone"""")
        )
    }

    // ── Settings ───────────────────────────────────────────────────────────────────────────

    /**
     * Compose `SettingsScreen.kt:473`: top 16 / bottom 14 with a 10dp icon-to-label gap and an
     * 18dp icon. Views had 14/14, no gap and a 24dp icon, so the tile block rendered 16px taller
     * and pushed every section below it out of alignment.
     */
    @Test
    fun `appearance tile geometry matches compose`() {
        val style = values("styles").substringAfter("""name="FcAppearanceButton"""")
            .substringBefore("</style>")
        assertTrue("tile paddingTop must be 16dp", style.contains(">16dp<"))
        assertTrue("tile paddingBottom must be 14dp", style.contains(">14dp<"))

        val settings = layout("fc_fragment_settings")
        assertEquals(
            "all three mode icons must be 18dp, not 24dp",
            3,
            Regex("""fcMode\w+Icon"\s+android:layout_width="18dp"""").findAll(settings).count()
        )
    }

    /** The app and compose use `icon_mode_day/night/auto`; views shipped a different icon set. */
    @Test
    fun `appearance tiles use the app's mode icons`() {
        val settings = layout("fc_fragment_settings")
        for (icon in listOf("fc_icon_mode_day", "fc_icon_mode_night", "fc_icon_mode_auto")) {
            assertTrue("$icon must be referenced", settings.contains("@drawable/$icon"))
        }
        for (wrong in listOf("fc_ic_sun", "fc_ic_moon", "fc_ic_auto")) {
            assertFalse(
                "$wrong is not the app's icon — the 'auto' one was a spiky asterisk against " +
                    "the app's half-filled circle",
                settings.contains("@drawable/$wrong\"")
            )
        }
    }

    /**
     * Compose routes this row through the shared `ListItem`: both sides 17sp, label
     * foregroundPrimary at natural width, value foregroundSecondary weighted and end-aligned,
     * then a 24dp chevron. Views had a 13sp grey label over a 16sp dark value and NO chevron.
     */
    @Test
    fun `location row has a chevron and ListItem typography`() {
        val settings = layout("fc_fragment_settings")
        val row = settings.substringAfter("@drawable/fc_icon_location").substringBefore("fcLocationHelper")
        assertTrue("location row needs the trailing chevron", row.contains("fc_ic_chevron_right"))
        assertEquals(
            "label and value are both 17sp (bodyMedium)",
            2,
            Regex("""fcTextSizeSp="17"""").findAll(row).count()
        )
    }

    /** The app's screen rhythm is 20dp sides / 32dp ends, not a flat 20dp. */
    @Test
    fun `settings and help use the app's padding rhythm`() {
        for (name in listOf("fc_fragment_settings", "fc_fragment_help")) {
            val l = layout(name)
            assertTrue("$name: 20dp sides", l.contains("""android:paddingStart="20dp""""))
            assertTrue("$name: 32dp ends", l.contains("""android:paddingTop="32dp""""))
            assertFalse(
                "$name: the flat `padding=\"20dp\"` was the systemic cause of four screens' drift",
                l.contains("""android:padding="20dp"""")
            )
        }
    }

    // ── Help ───────────────────────────────────────────────────────────────────────────────

    /**
     * Compose `Lists.kt:88`: a single-line row is a FIXED 48dp, not wrap_content plus padding.
     * Padding made each row ~8dp taller and the error ACCUMULATED — 146px by the footer.
     */
    @Test
    fun `help rows are a fixed 48dp and ellipsize`() {
        val row = layout("fc_item_help_row")
        assertTrue("row height must be a fixed 48dp", row.contains("""android:layout_height="48dp""""))
        assertTrue("single line", row.contains("""android:maxLines="1""""))
        assertTrue("ellipsized, like the app", row.contains("""android:ellipsize="end""""))
    }

    // ── drawer ─────────────────────────────────────────────────────────────────────────────

    /**
     * The two palettes share member names: `surfaceSecondary` is #FFFFFF in the neutral set and
     * #08361B in the brand one. The drawer was built against the neutral set, so its panel
     * rendered WHITE where the app's is dark green.
     */
    @Test
    fun `drawer is painted from the brand palette`() {
        val drawer = layout("fc_drawer")
        assertTrue(
            "panel must be fc_brand_surface_secondary (#08361B), not the neutral #FFFFFF",
            drawer.contains("@color/fc_brand_surface_secondary")
        )
        assertFalse(
            "no neutral foreground tokens on a brand surface — they vanish on dark green",
            drawer.contains("@color/fc_foreground_primary\"") ||
                drawer.contains("@color/fc_foreground_secondary\"")
        )
    }

    /** A PrimaryButton on the drawer's brand surface needs the Green700 fill, not #08361B. */
    @Test
    fun `drawer sign-up button has the on-brand fill`() {
        assertTrue(
            "fc_bg_primary_button_on_brand must exist — the default fill is invisible on the " +
                "drawer's dark green",
            File(res, "drawable/fc_bg_primary_button_on_brand.xml").exists()
        )
    }

    // ── shared tokens ──────────────────────────────────────────────────────────────────────

    /**
     * Compose's `RadioButton` applies the translucent `surfaceActive` TWICE (`Surface(color=)`
     * plus the inner Row), so a selected row renders the opaque composite #A6E1C0. A single XML
     * shape cannot stack an alpha, so the composite is stated. Measured identical on the app and
     * on compose; views rendered #C6E6D5 by applying it once.
     */
    @Test
    fun `selected radio row uses the double-composited colour`() {
        assertTrue(
            "selected rows must use fc_surface_active_double (#A6E1C0)",
            File(res, "drawable/fc_bg_radio_row_selected.xml").readText()
                .contains("fc_surface_active_double")
        )
        assertTrue(
            "and that colour must be the measured composite",
            values("colors").contains("""name="fc_surface_active_double">#A6E1C0""")
        )
    }

    /**
     * `android:textFontWeight` only interpolates against a NAMED family; with the default
     * typeface it snaps to normal/bold, so a nominal 600 rendered at 400's width (180px against
     * the app's 189px). Compose 1.6+ also defaults `includeFontPadding` to false, where a
     * TextView defaults it to true and adds ~3dp of leading per line.
     */
    @Test
    fun `theme fixes TextView font metrics`() {
        val style = values("themes").substringAfter("""name="FcTextView"""").substringBefore("</style>")
        assertTrue("includeFontPadding must be false, as Compose defaults it", style.contains("false"))
        assertTrue("an explicit family is what lets textFontWeight interpolate", style.contains("sans-serif"))
    }

    /** The app's rotating splash mark is 100dp (`SplashScreen.kt:203`); views shipped 96dp. */
    @Test
    fun `splash logo is 100dp`() {
        assertTrue(
            "splash mark must be 100dp",
            layout("fc_fragment_splash").contains("""android:layout_width="100dp"""")
        )
    }

    // ── the performance boundary ───────────────────────────────────────────────────────────

    /**
     * `FcText` renders text through Compose so it matches the app's rasteriser exactly — but it
     * is a composition host. Measured on the Home feed with ONE converted title per row:
     *
     * | | TextView | FcText |
     * |---|---|---|
     * | janky frames | 0.00% | 3.25% |
     * | 99th percentile | 24ms | 73ms |
     *
     * 73ms is four times the 16.7ms budget. Recycled rows keep `TextView` and accept the
     * rasterisation difference as the price of smooth scrolling.
     */
    @Test
    fun recycledRowsMustNotUseFcText() {
        val offenders = File(res, "layout").listFiles()
            .orEmpty()
            .filter { it.name.startsWith("fc_item_") && it.name.endsWith(".xml") }
            .filter { it.readText().contains("widgets.FcText") }
            .map { it.name }
        assertEquals(
            "These are RECYCLED row layouts. FcText in a recycled row was measured to take the " +
                "99th-percentile frame from 24ms to 73ms. Use TextView here.",
            emptyList<String>(),
            offenders
        )
    }

    /** Every layout must parse — a converted layout once emitted `app:` with no `xmlns:app`. */
    @Test
    fun `every layout is well-formed and declares the namespaces it uses`() {
        val broken = File(res, "layout").listFiles().orEmpty()
            .filter { it.extension == "xml" }
            .filter { f ->
                val t = f.readText()
                t.contains("app:") && !t.contains("xmlns:app=")
            }
            .map { it.name }
        assertEquals("layouts using app: must declare xmlns:app", emptyList<String>(), broken)
    }
}
