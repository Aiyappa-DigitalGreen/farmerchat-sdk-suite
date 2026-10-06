package org.digitalgreen.farmerchat.sdk.compose

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Pins the app-parity values this flavour was measured into.
 *
 * The compose flavour measures **0.02%-0.15%** against the real app on the screens that were
 * captured — effectively pixel-identical. That was established by diffing against the reference
 * APK on an emulator, which CI cannot reproduce (it needs the app, an AVD, network and a matching
 * served-label set). So this guards the *causes* instead: the specific source values that were
 * wrong and got fixed. Each assertion names the measurement or app source line behind it.
 */
class ComposeAppParityTest {

    private val src = File("src/main/java/org/digitalgreen/farmerchat/sdk/compose")

    private fun read(rel: String) = File(src, rel).readText()

    /** App `SplashScreen.kt:203` — the rotating mark is 100dp. The SDK shipped 72dp. */
    @Test
    fun `splash logo is 100dp`() {
        val body = read("screens/SplashScreen.kt")
        assertTrue("splash mark must be 100dp", body.contains(".size(100.dp)"))
        assertFalse("72dp was 28dp smaller than the app's", body.contains(".size(72.dp)"))
    }

    /**
     * 300dp is `FullScreenMessage`'s own fallback box (app `NoInternetScreen.kt:158`). Every
     * screen that supplies its own illustration overrides it to **322dp** —
     * `AccountSuccessScreen.kt:82`, `AppNavGraph.kt:832`, `LocationPromptHost.kt:746/791/864`.
     * The SDK's call sites took the 300 default and rendered 22dp narrower.
     */
    @Test
    fun `illustration call sites pass the app's 322dp`() {
        assertTrue(
            "FarmerIllustration needs a maxWidth parameter, defaulting to the fallback 300dp",
            read("components/FullScreenMessage.kt").contains("maxWidth: Dp = 300.dp")
        )
        for (f in listOf("screens/AccountScreens.kt", "screens/LocationPromptHost.kt")) {
            val body = read(f)
            val bare = Regex("""FarmerIllustration\(painter = painter\)""").findAll(body).count()
            assertEquals(
                "$f: every FarmerIllustration must pass maxWidth = 322.dp — the app's sites do",
                0, bare
            )
        }
    }

    /**
     * App `ChatHistoryScreen.kt:160`: the list is 20dp horizontal / 8dp vertical, not a flat
     * 16dp. Flat padding was the systemic cause of drift on Help, Settings, LanguageChooser and
     * this screen.
     */
    @Test
    fun `chat history uses the app's list padding`() {
        val body = read("screens/ChatHistoryScreen.kt")
        assertTrue(
            "list padding must be 20dp horizontal / 8dp vertical",
            body.contains("PaddingValues(horizontal = 20.dp, vertical = 8.dp)")
        )
        assertFalse("the flat 16dp was wrong", body.contains("PaddingValues(16.dp)"))
        assertTrue(
            "date-group header is 12dp above / 8dp below (app :170)",
            body.contains("padding(top = 12.dp, bottom = 8.dp)")
        )
        assertTrue(
            "the paginating spinner sits in 24dp (app :213)",
            body.contains("padding(vertical = 24.dp)")
        )
    }

    /**
     * `InputComposer`'s placeholder must resolve the SERVED label, not a raw literal. It
     * defaulted to `"Ask about your farm..."`; `HomeScreen` passed the label explicitly, which
     * masked the bug, while `ChatScreen` took the default and rendered English in every language.
     */
    @Test
    fun `composer placeholder resolves the served label`() {
        val body = read("components/InputComposer.kt")
        assertFalse(
            "a raw literal default renders English on every non-English device",
            body.contains("""placeholder: String = "Ask about your farm...",""")
        )
        assertTrue(
            "must default to label(Labels.ASK_ABOUT_YOUR_FARM, …)",
            body.contains("placeholder: String = label(Labels.ASK_ABOUT_YOUR_FARM")
        )
    }

    /**
     * The app's `caption` (13sp/18sp @400) exists in `theme/Type.kt` and had ZERO readers, so it
     * was hand-rolled as `labelSmall.copy(fontWeight = Normal)` at four call sites. `labelSmall`
     * has 16 readers and must not be retuned.
     */
    @Test
    fun `the caption token is used, not hand-rolled`() {
        assertTrue(
            "theme/Type.kt must define the app's caption",
            read("theme/Type.kt").contains("val caption = langStyle(13.sp, 18.sp, FontWeight(400))")
        )
        val handRolled = File(src, "screens").listFiles().orEmpty()
            .filter { it.extension == "kt" }
            .filter { it.readText().contains("labelSmall.copy(fontWeight = FontWeight.Normal)") }
            .map { it.name }
        assertEquals(
            "use the `caption` token instead of copying labelSmall — it already exists",
            emptyList<String>(), handRolled
        )
    }

    /**
     * The app auto-focuses only its OTP input (`OtpInput.kt:43`), never the phone field — so the
     * keyboard does not cover the agreement card and both send buttons. The phone placeholder is
     * the literal digit mask; `ENTER_PHONE_NUMBER` is the screen's HEADING label.
     */
    @Test
    fun `auth phone field does not autofocus and uses the digit mask`() {
        val body = read("screens/AuthScreen.kt")
        assertTrue("phone field must not autofocus", body.contains("autofocus = false"))
        assertTrue("placeholder is the literal mask", body.contains(""""00000 00000""""))
        assertFalse(
            "ENTER_PHONE_NUMBER is the heading, not the placeholder",
            body.contains("placeholder = label(Labels.ENTER_PHONE_NUMBER")
        )
    }

    /** One source of truth for the SDK version: Gradle, via BuildConfig. */
    @Test
    fun `help screen reads the version from the single source`() {
        val body = read("screens/HelpScreen.kt")
        assertTrue(
            "version must come from FarmerChatVersion, not a literal",
            body.contains("FarmerChatVersion.VERSION")
        )
        assertFalse("no hardcoded version", body.contains(""""FarmerChat v.2.0.0""""))
    }

    /** Help's legal rows show the SERVED label; the #legal payload's own title is English-only. */
    @Test
    fun `help legal rows use served labels`() {
        val body = read("screens/HelpScreen.kt")
        assertTrue(body.contains("label(Labels.TERMS_OF_USE"))
        assertTrue(body.contains("label(Labels.PRIVACY_POLICY"))
    }
}
