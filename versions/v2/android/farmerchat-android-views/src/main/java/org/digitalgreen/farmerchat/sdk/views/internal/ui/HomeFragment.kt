package org.digitalgreen.farmerchat.sdk.views.internal.ui

import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationErrorType
import org.digitalgreen.farmerchat.sdk.core.ui.location.isLocationObtained
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationTriggerSource
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationPromptEvent
import org.digitalgreen.farmerchat.sdk.views.internal.util.FcInsets
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcTokens
import android.graphics.Rect
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.core.net.toUri
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import androidx.core.view.updateLayoutParams
import androidx.core.view.updatePadding
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.analytics.cardPositionLabels
import org.digitalgreen.farmerchat.sdk.core.analytics.toHomeCardAnalytics
import org.digitalgreen.farmerchat.sdk.core.audio.AudioRecorder
import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.model.LiveStockDetail
import org.digitalgreen.farmerchat.sdk.core.model.OptionDto
import org.digitalgreen.farmerchat.sdk.core.model.SectionDto
import org.digitalgreen.farmerchat.sdk.core.model.UserNameRequest
import org.digitalgreen.farmerchat.sdk.core.network.NetworkUtils
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.home.HomeAction
import org.digitalgreen.farmerchat.sdk.core.ui.home.HomeViewModel
import org.digitalgreen.farmerchat.sdk.core.ui.home.isAcceptedTranscription
import org.digitalgreen.farmerchat.sdk.core.ui.name.EnterNameViewModel
import org.digitalgreen.farmerchat.sdk.core.ui.name.UserNameAction
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.databinding.FcFragmentHomeBinding
import org.digitalgreen.farmerchat.sdk.views.internal.BaseFragment
import org.digitalgreen.farmerchat.sdk.views.internal.NavRoutes
import org.digitalgreen.farmerchat.sdk.views.internal.coreVm
import org.digitalgreen.farmerchat.sdk.views.internal.input.InputOverlaysController
import org.digitalgreen.farmerchat.sdk.views.internal.journeyHost
import org.digitalgreen.farmerchat.sdk.views.internal.util.loadSvgOrImage
import org.digitalgreen.farmerchat.sdk.views.internal.util.weatherFallbackRes
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.PrimaryButtonView
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.ToastView
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationPromptState
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcRecolor

/** Home dashboard (doc 01 §3.7). */
internal class HomeFragment : BaseFragment(R.layout.fc_fragment_home), HomeFeedAdapter.Callbacks {

    private var lastApproxLocationName: String? = null

    /**
     * App parity (HomeScreen.kt:241-255): true while a CAMPAIGN (widget) location flow is between
     * permission and fix — the feed is swapped for the "Getting your location" spinner. The pill
     * and weather flows leave the feed in place.
     */
    private var widgetGpsLoading = false


    override val analyticsScreenName: String = AnalyticsScreens.HOME

    private val vm: HomeViewModel by lazy { coreVm("home") { graph.homeViewModel() } }
    private val vmProfile: EnterNameViewModel by lazy {
        coreVm("home_profile") { graph.enterNameViewModel() }
    }

    private lateinit var binding: FcFragmentHomeBinding
    private lateinit var adapter: HomeFeedAdapter
    private var overlays: InputOverlaysController? = null

    /**
     * 2.0.0: the mandatory Terms-of-Use acceptance gate (#7a). Owns its non-cancellable sheet and
     * the "Read terms" content screen; driven from [observeState] on every emission.
     */
    private var termsGate: TermsOfUseGateController? = null

    private val viewedStatementIds = mutableSetOf<String>()

    /** Card_Viewed is emitted at most once per card id (app HomeScreen.kt:2072 viewedCardIds). */
    private val viewedCardIds = mutableSetOf<String>()

    /**
     * `Card_Position` labels for the currently rendered feed, in feed order
     * (app HomeScreen.kt:2023 buildImageStatementSequences). Rebuilt on every submit.
     */
    private var feedPositionLabels: Map<String, String> = emptyMap()

    /**
     * Identity of the feed whose `Card_Shown` batch has already been announced. The state
     * collector re-enters `UiState.Success` on every unrelated emission (card dismissal,
     * weather landing, crop update), so without this guard the batch would re-fire each time.
     * The app is keyed on the feed response itself (app HomeScreen.kt:925 `LaunchedEffect`).
     */
    private var shownFeedKey: String? = null

    /**
     * 2.0.0 unified composer instead of the pinned Photo/Speak/Type row — Compose parity with
     * `HomeScreen.isComposerUi`. Mirrors the app's `v2_composer_ui_enabled` flag via the host's
     * `enableComposerUi`, which defaults to following `enableAgenticChat`.
     */
    private val isComposerUi: Boolean get() = graph.config.resolvedComposerUi

    /**
     * The single image attached to the composer, awaiting send. App parity
     * (fc-compose-agentic HomeScreen.kt:338/374 `photoUris = listOf(uri)`): in composer mode a
     * picked image is attached to the bar and travels to chat together with the typed question.
     */
    private var attachedPhoto: Uri? = null

    // Content-card tap bookkeeping (FetchImageStatement → navigate).
    private var pendingQuestion: String? = null
    private var pendingCardImageUrl: String? = null
    private var pendingStatementId: String? = null

    // Voice transcription bookkeeping.
    private var pendingAudioFile: File? = null
    private var voiceMessageReferenceId: String? = null

    private fun userId(): String = graph.prefs.getString(SdkPreferences.Keys.PREF_USER_ID, "")

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding = FcFragmentHomeBinding.bind(view)

        adapter = HomeFeedAdapter(this)
        binding.fcHomeFeed.layoutManager = LinearLayoutManager(requireContext())
        binding.fcHomeFeed.adapter = adapter
        binding.fcHomeFeed.addOnScrollListener(object : RecyclerView.OnScrollListener() {
            override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                trackVisibleCards()
            }
        })

        overlays = InputOverlaysController(
            fragment = this,
            binding = binding.fcHomeOverlays,
            screenName = AnalyticsScreens.HOME,
            onTextSubmitted = { text -> navigateToChat(question = text) },
            onImagePicked = { uri ->
                if (isComposerUi) {
                    // Attach, don't navigate: the composer owns the query until send.
                    attachedPhoto = uri
                    binding.fcHomeComposer.setPhotoUris(listOf(uri))
                } else {
                    navigateToChat(imageUri = uri.toString())
                }
            },
            onVoiceFinished = { file -> transcribeVoice(file) },
            onRecordingFailed = {
                binding.fcHomeToast.show(
                    label(Labels.FAILED_TO_START_RECORDING, "Failed to start recording"),
                    ToastView.Type.ERROR
                )
            }
        )

        renderStaticTexts()

        binding.fcHomeAppBar.fcAppBarLeft.setOnClickListener { journeyHost()?.openDrawer() }
        // App parity: only the HOME menu button is a full pill (HomeAppBar.kt, 2026-09-15).
        // The shared fc_view_appbar include keeps the 12dp chip for back / close elsewhere.
        binding.fcHomeAppBar.fcAppBarLeft.setBackgroundResource(R.drawable.fc_bg_appbar_chip_round)
        // Set after inflation, so the inflater recolor never saw it.
        FcRecolor.maybeRecolor(binding.fcHomeAppBar.fcAppBarLeft)
        binding.fcHomeAppBar.fcAppBarLeft.isVisible = graph.config.showDrawer  // C3
        if (isComposerUi) setUpComposer() else setUpLegacyInputRow()
        binding.fcHomeAppBar.fcAppBarTitle.text = ""
        binding.fcHomeAppBar.fcAppBarWeather.setOnClickListener { onWeatherClick() }
        binding.fcHomeErrorRetry.setOnClickListener {
            graph.analytics.track(
                AnalyticsEvents.CONTENT_TRY_AGAIN_CLICKED,
                mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME)
            ) // app HomeScreen.kt:1239
            loadHome()
        }

        // Entry effects (doc 01 §3.7): NewConversation, FetchUserProfile, LoadHome, LoadWeather.
        val uid = userId()
        val context = requireContext().applicationContext
        vm.onAction(HomeAction.NewConversation(context, uid, null))
        if (uid.isNotBlank()) {
            vm.onAction(HomeAction.FetchUserProfile(context, uid))
        }
        loadHome()
        vm.onAction(HomeAction.LoadWeather(context, uid))

        // 2.0.0 Terms-of-Use acceptance gate. App parity (HomeScreen.kt:858): re-checked on
        // EVERY Home entry so an updated policy version re-prompts; guests with no provisioned
        // userId are skipped inside the ViewModel.
        termsGate = TermsOfUseGateController(
            fragment = this,
            onAccept = { vm.onAction(HomeAction.AcceptTerms(userId())) },
            onError = { message -> binding.fcHomeToast.show(message, ToastView.Type.ERROR) }
        )
        vm.onAction(HomeAction.FetchPolicyAcceptanceStatus(uid))

        observeState()
    }

    private fun renderStaticTexts() {
        // In composer mode there are no Photo/Speak/Type buttons to tap, so the v1 greeting
        // would be a lie. The app's agentic header reads "For your farm today" (app parity:
        // HomeScreen.kt:1042); only that title is ported here — the logo mark, leaf flourishes
        // and location pill of the pinned header are not (see versions/v2/README.md).
        // Compose parity (HomeScreen.kt:1136): the agentic header carries the centred logo mark;
        // the legacy Home does not.
        // The sunbeam glow is a HOME-only treatment (see fc_view_appbar.xml); the shared bar
        // now defaults it off so Settings/Help/etc render the app's flat #008236.
        binding.fcHomeAppBar.fcAppBarGlow.isVisible = true
        // App parity (AppBars.kt:186): HomeAppBar is 52dp, where the shared DefaultAppBar is 64dp
        // (:96). Views' single include is 64dp, which put Home's whole header 12dp low.
        binding.fcHomeAppBar.root.layoutParams =
            binding.fcHomeAppBar.root.layoutParams.also {
                it.height = (52 * resources.displayMetrics.density).toInt()
            }
        binding.fcHomeHeaderLogo.isVisible = isComposerUi

        // Compose parity (HomeScreen.kt:1152): the location pill is part of the AGENTIC header
        // only; the legacy Home has no pill in this position.
        binding.fcHomeLocationPill.isVisible = isComposerUi
        if (isComposerUi) {
            binding.fcHomeLocationPill.bind(
                manager = graph.locationPromptManager,
                prefs = graph.prefs,
                labelFor = { key, fallback -> label(key, fallback) },
                onTap = {
                    // Re-run the flow rather than jumping to system Settings: with
                    // denyCount >= 2 and no permission the manager lands on Recovery, which is
                    // what re-shows the sheet (with its own "Turn on in Settings" button).
                    if (graph.locationPromptManager.state.value == LocationPromptState.Idle) {
                        graph.locationPromptManager.triggerFromLocalContext()
                    }
                }
            )
            // The pill's text depends on live location state, so follow it. `collectWhenStarted`
            // is this flavour's own helper (BaseFragment.kt:37) — same STARTED-scoped collection
            // every other observer here uses.
            graph.locationPromptManager.state.collectWhenStarted { st ->
                binding.fcHomeLocationPill.refresh(st)
            }
            // App parity (HomeScreen.kt:281): refresh the feed AND the weather once a location
            // update succeeds while on Home — keyed on the success signals only, so a backed-out
            // or denied prompt does not trigger a wasted reload.
            graph.locationPromptManager.events.collectWhenStarted { event ->
                val isWidgetUpdate = event is LocationPromptEvent.LocationUpdatedFromWidget
                val isLocalContextSuccess = event is LocationPromptEvent.Continue &&
                    event.source == LocationTriggerSource.LocalContext &&
                    event.isLocationObtained()
                if (isWidgetUpdate || isLocalContextSuccess) {
                    loadHome(skipLoadingCheck = true)
                    vm.onAction(
                        HomeAction.LoadWeather(
                            requireContext().applicationContext, userId(), skipLoadingCheck = true
                        )
                    )
                }
            }
        }
        binding.fcHomeGreeting.text = if (isComposerUi) {
            label(Labels.FOR_YOUR_FARM_TODAY, "For your farm today")
        } else {
            label(
                Labels.GET_STARTED_BY_CLICKING_ON_PHOTO_SPEAK_OR_TYPE_TO_ASK_YOUR_QUESTION,
                "Tap a button to ask a question"
            )
        }
        binding.fcInputPhotoLabel.text = label(Labels.PHOTO, "Photo")
        binding.fcInputSpeakLabel.text = label(Labels.SPEAK, "Speak")
        binding.fcInputTypeLabel.text = label(Labels.TYPE, "Type")
        binding.fcHomeErrorTitle.text = label(Labels.CANT_LOAD_RIGHT_NOW, "Can't load right now")
        binding.fcHomeErrorRetry.text = label(Labels.TRY_AGAIN, "Try again")
        binding.fcHomeLoading.text = if (widgetGpsLoading) {
            label(Labels.GETTING_YOUR_LOCATION, "Getting your location…")
        } else {
            label(Labels.GETTING_TODAYS_ADVICE, "Getting today's advice")
        }
        if (isComposerUi) applyAgenticSurface()
    }

    /**
     * App HomeScreen.kt `isComposerUi` surface, which views drew as the v1 all-green Home:
     *  - grey `surfacePrimary` page with the brand band + sunbeams + glow BEHIND the feed;
     *  - the header (bar, logo, leaf-flanked title, pill) as a FIXED transparent overlay the feed
     *    scrolls under, the feed reserving its height (the app's item-0 spacer);
     *  - the feed's top strip masked to transparent so cards dissolve into the band (DstIn,
     *    transparent to 80% of the header, opaque at its bottom edge).
     * The bar itself is transparent here (`appBar(showBackground = false)`), so its own glow is
     * off — the backdrop draws the glow instead.
     */
    private fun applyAgenticSurface() {
        val ctx = requireContext()
        binding.root.setBackgroundColor(FcTokens.color(ctx, R.color.fc_surface_primary))
        val rawBrand = FcTokens.color(ctx, R.color.fc_green700)
        binding.fcHomeBackdrop.brandColor = rawBrand
        binding.fcHomeBackdrop.glowTint =
            org.digitalgreen.farmerchat.sdk.views.internal.theme.FcRecolor.active(ctx)?.accent
        binding.fcHomeBackdrop.isVisible = true
        binding.fcHomeAppBar.root.background = null
        binding.fcHomeAppBar.fcAppBarGlow.isVisible = false

        binding.fcHomeGreeting.isVisible = false
        binding.fcHomeSectionHeader.isVisible = true
        binding.fcHomeSectionHeader.title = label(Labels.FOR_YOUR_FARM_TODAY, "For your farm today")
        binding.fcHomeSectionHeader.accentColor = org.digitalgreen.farmerchat.sdk.views.internal.theme.FcTokens.accent(ctx)
        binding.fcHomeSectionHeader.titleColor = FcTokens.color(ctx, R.color.fc_brand_foreground_primary)

        val header = binding.fcHomeHeader
        header.translationZ = 1f
        header.addOnLayoutChangeListener { v, _, top, _, bottom, _, oldTop, _, oldBottom ->
            val h = bottom - top
            if (h == oldBottom - oldTop && (v.layoutParams as ViewGroup.MarginLayoutParams).bottomMargin == -h) {
                return@addOnLayoutChangeListener
            }
            v.post {
                (v.layoutParams as ViewGroup.MarginLayoutParams).let { lp ->
                    if (lp.bottomMargin != -h) {
                        lp.bottomMargin = -h
                        v.layoutParams = lp
                    }
                }
                binding.fcHomeFeed.updatePadding(top = h)
                // The app's mask runs in SCREEN coordinates from 0 to the header's bottom
                // (status bar included); this list starts below the status bar.
                val statusTop = (binding.fcHomeHeader.parent as View).paddingTop
                binding.fcHomeFeed.setFade(
                    startPx = (0.80f * (h + statusTop)).toInt() - statusTop,
                    endPx = h
                )
            }
        }
    }

    // ------------------------------------------------------------------ input surface

    /** 1.0.0 input: the pinned Photo / Speak / Type row driving the overlay panels. */
    private fun setUpLegacyInputRow() {
        binding.fcHomeComposer.isVisible = false
        binding.fcHomeInputButtons.isVisible = true
        // Host feature flags — app parity with ios `HomeCells.swift:52-53`. `enableImages` /
        // `enableVoice` were declared on Android and honoured by NOTHING until 2026-09-16;
        // see docs/04 "Config-parity audit (2026-09-16)".
        binding.fcInputPhoto.isVisible = graph.config.enableImages
        binding.fcInputSpeak.isVisible = graph.config.enableVoice
        binding.fcInputPhoto.setOnClickListener {
            trackIconClick("Image")
            overlays?.showPhotoInput()
        }
        binding.fcInputSpeak.setOnClickListener { onSpeakClick() }
        binding.fcInputType.setOnClickListener {
            trackIconClick("Text")
            overlays?.showTextInput()
        }
    }

    /**
     * 2.0.0 input: the persistent floating composer replaces BOTH the pinned button row and the
     * text overlay (app parity: fc-compose-agentic HomeScreen.kt:1590; Compose parity:
     * HomeScreen.kt:947). Standard (non-compact) metrics, brand-green sheet.
     */
    private fun setUpComposer() {
        binding.fcHomeInputButtons.isVisible = false
        val composer = binding.fcHomeComposer
        composer.isVisible = true
        composer.compact = false
        composer.setSurfaceColorRes(R.color.fc_green700)
        // Compose defaults the band to `surfacePrimary`: agentic Home IS the grey surface, so the
        // 10dp gutters and the nav strip under the floating pill read grey (measured on the app:
        // (236,236,238) either side of the pill). Now that views paints the agentic surface
        // (applyAgenticSurface), the band follows it.
        composer.setFadeColorRes(R.color.fc_surface_primary)
        // The idle rainbow aura around the field is a Home treatment in the app.
        composer.showAura = true
        composer.setPlaceholder(label(Labels.ASK_ABOUT_YOUR_FARM, "Ask about your farm..."))

        composer.onPhotoClick = {
            // Camera is only offered while nothing is attached (app: `if (photoUris.isEmpty())`).
            if (attachedPhoto == null) {
                trackIconClick("Image")
                overlays?.showPhotoInput()
            }
        }
        composer.onVoiceClick = { onSpeakClick() }
        composer.onRemovePhoto = {
            attachedPhoto = null
            composer.setPhotoUris(emptyList())
        }
        // Tapping the field to type is the composer's equivalent of the legacy Type button, so
        // CHAT_ICON_CLICKED (Text) fires on focus gain (app parity: HomeScreen.kt:1625).
        composer.onFocusChange = { focused -> if (focused) trackIconClick("Text") }
        composer.onSend = { text -> sendFromComposer(text) }

        // A config change destroys the view but keeps the fragment, so an image attached
        // before the rotation must be re-shown or the bar would send it with no thumbnail.
        attachedPhoto?.let { composer.setPhotoUris(listOf(it)) }

        composer.onBarHeightChanged = { height -> reserveComposerSpace(height) }
        reserveComposerSpace(composer.barHeightPx())

        // The composer's own listener reads ROOT insets, but its init-time requestApplyInsets()
        // ran before it was attached. Ask again now that it is in the hierarchy, then re-read
        // the settled bar height: insets are dispatched before the first layout, and the height
        // only changes (and only then re-fires onBarHeightChanged) when the nav-bar inset
        // exceeds the 20dp design gap.
        ViewCompat.requestApplyInsets(binding.root)
        binding.root.post { if (view != null) reserveComposerSpace(composer.barHeightPx()) }
    }

    private fun trackIconClick(iconType: String) {
        graph.analytics.track(
            AnalyticsEvents.CHAT_ICON_CLICKED,
            mapOf(
                AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME,
                AnalyticsProps.ICON_TYPE to iconType
            )
        )
    }

    /**
     * App parity (HomeScreen.kt:1635): an attached image travels to chat with the typed
     * question; otherwise a non-blank question goes on its own. The composer has already
     * cleared its text field by the time this runs.
     */
    private fun sendFromComposer(text: String) {
        val uri = attachedPhoto
        attachedPhoto = null
        binding.fcHomeComposer.setPhotoUris(emptyList())
        when {
            uri != null -> navigateToChat(question = text, imageUri = uri.toString())
            text.isNotBlank() -> navigateToChat(question = text)
        }
    }

    /**
     * The bar floats over the feed, so the feed reserves its at-rest height. The enclosing
     * LinearLayout is `fitsSystemWindows`, so the nav-bar inset the bar folds in already sits
     * outside the feed — subtract it or the last card stops short.
     */
    private fun reserveComposerSpace(barHeightPx: Int) {
        val navBottom = FcInsets.overlapping(binding.root, WindowInsetsCompat.Type.navigationBars()).bottom
        binding.fcHomeFeed.updatePadding(bottom = (barHeightPx - navBottom).coerceAtLeast(0))
        // The toast is declared after the composer in the root FrameLayout, so it draws on top
        // of it. Its 24dp XML margin was safe while the only bottom content was the feed; the
        // composer now occupies ~92dp there, so lift the toast clear of the bar.
        val gap = (24f * resources.displayMetrics.density).toInt()
        binding.fcHomeToast.updateLayoutParams<FrameLayout.LayoutParams> {
            bottomMargin = (barHeightPx - navBottom).coerceAtLeast(0) + gap
        }
    }

    /** Which of spinner / feed / error shows — the widget GPS flow forces the spinner. */
    private fun renderFeedVisibility(feed: UiState<*>) {
        val loading = widgetGpsLoading || feed is UiState.Loading || feed is UiState.Idle
        binding.fcHomeLoading.isVisible = loading
        binding.fcHomeFeed.isVisible = !loading && feed is UiState.Success
        binding.fcHomeError.isVisible = !loading && feed is UiState.Error
    }

    private fun loadHome(skipLoadingCheck: Boolean = false) {
        val time = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).format(Date())
        // Guest passes userId = null (doc 01).
        vm.onAction(
            HomeAction.LoadHome(
                context = requireContext().applicationContext,
                userDeviceTime = time,
                userId = userId().ifBlank { null },
                skipLoadingCheck = skipLoadingCheck
            )
        )
    }

    private fun observeState() {
        graph.locationPromptManager.state.collectWhenStarted { st ->
            // App parity (HomeScreen.kt:258-266): a location-flow error while Home is showing goes
            // to the shared Error screen, and the flow closes silently.
            if (st is LocationPromptState.Error) {
                findNavController().navigate(
                    R.id.fc_dest_error,
                    NavRoutes.errorArgs(
                        isNetworkError = st.type == LocationErrorType.NoNetwork,
                        fromScreen = "home"
                    ),
                    NavRoutes.singleTop()
                )
                graph.locationPromptManager.dismiss(emitContinue = false)
            }
            val loading = when (st) {
                is LocationPromptState.RequestPermission -> st.source == LocationTriggerSource.Campaign
                is LocationPromptState.RequestEnableGps -> st.source == LocationTriggerSource.Campaign
                is LocationPromptState.FetchingLocation -> st.source == LocationTriggerSource.Campaign
                else -> false
            }
            if (loading != widgetGpsLoading) {
                widgetGpsLoading = loading
                binding.fcHomeLoading.text = if (loading) {
                    label(Labels.GETTING_YOUR_LOCATION, "Getting your location…")
                } else {
                    label(Labels.GETTING_TODAYS_ADVICE, "Getting today's advice")
                }
                renderFeedVisibility(vm.state.value.homeFeedState)
            }
        }
        vm.state.collectWhenStarted { state ->
            // App b72ea4da / compose HomeLocationPill(profileApproxLocationName): the profile
            // backfill writes the IP-derived place name AFTER first paint. The pill only followed
            // location-prompt state, so it stayed on "Set your location" while Settings — read
            // later — already showed "Bengaluru Urban (approximate)".
            if (isComposerUi && state.approxLocationName != lastApproxLocationName) {
                lastApproxLocationName = state.approxLocationName
                binding.fcHomeLocationPill.refresh(graph.locationPromptManager.state.value)
            }
            // 2.0.0 Terms-of-Use acceptance gate (#7a) — shows/hides its own sheet and content
            // screen from policyAcceptanceState + acceptTermsState. Guarded internally against
            // this collector's repeat emissions.
            termsGate?.render(state)

            // Feed
            renderFeedVisibility(state.homeFeedState)
            when (val feed = state.homeFeedState) {
                is UiState.Loading, UiState.Idle -> Unit
                is UiState.Success -> {
                    // App parity (HomeScreen.kt:1117): the greeting is the LABEL, never the API
                    // field. `renderStaticTexts()` already seeded this TextView with the
                    // GET_STARTED_BY_CLICKING... label, so there is nothing to do here.
                    //
                    // Overwriting it with `feed.data.greeting` was a LOCALISATION BUG, the same
                    // one fixed in the compose flavour: the #12 `greeting` is English-only, so
                    // this replaced a correctly translated label with English on every
                    // non-English device. The app reads `.greeting` nowhere.
                    val renderable = feed.data.renderableSections()
                    val labels = cardPositionLabels(renderable)
                    feedPositionLabels =
                        renderable.mapIndexed { i, s -> s.stableId() to labels[i] }.toMap()
                    // App HomeScreen.kt:925-935 — one Card_Shown per visible section when the
                    // feed response arrives, and only then (see shownFeedKey).
                    val feedKey = renderable.joinToString(",") { it.stableId() }
                    if (feedKey != shownFeedKey) {
                        shownFeedKey = feedKey
                        renderable.forEach { section ->
                            graph.analytics.trackHomeCardEvent(
                                AnalyticsEvents.CARD_SHOWN,
                                section.toHomeCardAnalytics(cardPosition(section))
                            )
                        }
                    }
                    adapter.submit(
                        // Drops plotline_widget (unrenderable in-SDK; would be blank cards).
                        sections = renderable,
                        // C3: SSFR card gated by config.enableSsfr.
                        ssfrEnabled = feed.data.ssfr_enable == true && graph.config.enableSsfr,
                        dismissedIds = state.dismissedCardIds,
                        // Compose parity (HomeScreen.kt:926): in composer mode the header above
                        // the feed already carries FOR_YOUR_FARM_TODAY, so the in-feed one is a
                        // duplicate of the same served string.
                        showHeader = !isComposerUi
                    )
                    binding.fcHomeFeed.post { trackVisibleCards() }
                }
                is UiState.Error -> Unit
            }

            // Weather pill (silent failures — pill hides). C3: gated by config.enableWeather.
            val weather = state.weatherState as? UiState.Success
            binding.fcHomeAppBar.fcAppBarWeather.isVisible = weather != null && graph.config.enableWeather
            weather?.let {
                binding.fcHomeAppBar.fcAppBarWeatherTemp.text = it.data.current_temp
                binding.fcHomeAppBar.fcAppBarWeatherIcon.setImageResource(
                    weatherFallbackRes(it.data.weather_icon)
                )
                if (it.data.weather_icon.startsWith("http")) {
                    binding.fcHomeAppBar.fcAppBarWeatherIcon.loadSvgOrImage(it.data.weather_icon)
                }
            }

            // Content-card statement result → navigate to chat.
            handleImageStatementState(state.imageStatementState)

            // Voice transcription result.
            handleTranscriptionState(state.voiceTranscribeState)

            // Crop update success → thank-you toast.
            if (state.cropUpdateState is UiState.Success) {
                binding.fcHomeToast.show(
                    label(
                        Labels.THANK_YOU_YOUR_ANSWER_HELPS_US_GIVE_MORE_ACCURATE_ADVICE,
                        "Thank you. Your answer helps us give more accurate advice."
                    ),
                    ToastView.Type.SUCCESS
                )
                vm.onAction(HomeAction.ConsumeResult)
            }
        }
    }

    // ------------------------------------------------------------------ mark viewed (≥50% visible)

    private fun trackVisibleCards() {
        val layoutManager = binding.fcHomeFeed.layoutManager as? LinearLayoutManager ?: return
        val first = layoutManager.findFirstVisibleItemPosition()
        val last = layoutManager.findLastVisibleItemPosition()
        if (first == RecyclerView.NO_POSITION) return
        val uid = userId()
        for (position in first..last) {
            val section = adapter.sectionAt(position) ?: continue
            val child = layoutManager.findViewByPosition(position) ?: continue
            val visibleRect = Rect()
            if (!child.getGlobalVisibleRect(visibleRect)) continue
            if (visibleRect.height() * 2 < child.height) continue

            // App HomeScreen.kt:2071-2074 — Card_Viewed fires for EVERY card type at >=50%
            // visibility, once per card id, with the full HomeCardAnalytics payload.
            if (viewedCardIds.add(section.stableId())) {
                graph.analytics.trackHomeCardEvent(
                    AnalyticsEvents.CARD_VIEWED,
                    section.toHomeCardAnalytics(cardPosition(section))
                )
            }

            // #14 mark-image-viewed stays limited to unviewed image/statement cards.
            if (section.type != "image" && section.type != "statement") continue
            if (section.is_viewed == true) continue
            val statementId = section.statement_id?.toString() ?: continue
            if (statementId.isBlank() || viewedStatementIds.contains(statementId)) continue
            viewedStatementIds.add(statementId)
            vm.onAction(HomeAction.MarkImageViewed(statementId, uid))
        }
    }

    private fun cardPosition(section: SectionDto): String =
        feedPositionLabels[section.stableId()] ?: ""

    // ------------------------------------------------------------------ card callbacks

    override fun onContentCardClick(section: SectionDto) {
        if (!NetworkUtils.isOnline(requireContext())) {
            findNavController().navigate(
                R.id.fc_dest_error,
                NavRoutes.errorArgs(isNetworkError = true, fromScreen = "home_card"),
                NavRoutes.singleTop()
            )
            return
        }
        // App HomeScreen.kt:610 — full HomeCardAnalytics payload.
        graph.analytics.trackHomeCardEvent(
            AnalyticsEvents.CARD_CLICKED,
            section.toHomeCardAnalytics(cardPosition(section))
        )
        val question = section.question_text ?: section.title.orEmpty()
        pendingQuestion = question
        pendingCardImageUrl = section.image_url?.takeIf { section.type == "image" }
        pendingStatementId = section.statement_id?.toString().orEmpty()
        val cardTriggerType = when (section.type) {
            "image" -> "image_card"
            "statement" -> "text_card"
            else -> null
        }

        // App parity (HomeScreen.kt:653): with AGENTIC CHAT on, the card tap skips the
        // pre-generated-answer API (#26) entirely and sends the card question into chat as a
        // normal text query — carrying the card's trigger type and, for image cards, its artwork
        // as a display-only banner. The views flavour had no agentic branch at all: it always
        // fetched the pre-generated answer, so an agentic host got the wrong request AND lost the
        // image_card / text_card provenance on both the API and the analytics.
        if (graph.config.enableAgenticChat) {
            if (question.isNotBlank()) {
                navigateToChat(
                    question = question,
                    contentCardImageUrl = pendingCardImageUrl,
                    contentCardTriggerType = cardTriggerType
                )
            }
            clearPendingCard()
            return
        }

        vm.onAction(
            HomeAction.FetchImageStatement(
                pendingStatementId.orEmpty(),
                // App falls back to statement_type, then "NA".
                cardTriggerType ?: section.statement_type ?: "NA"
            )
        )
    }

    private fun handleImageStatementState(state: UiState<org.digitalgreen.farmerchat.sdk.core.model.ImageStatementResponse>) {
        val question = pendingQuestion ?: return
        when (state) {
            is UiState.Success -> {
                val followUps = state.data.follow_up_questions
                    ?.sortedBy { it.sequence }
                    ?.map { it.question }
                    ?.takeIf { it.isNotEmpty() }
                navigateToChat(
                    question = question,
                    preGeneratedAnswer = state.data.short_answer,
                    followUpQuestions = followUps,
                    homeStatementId = pendingStatementId,
                    imageUri = pendingCardImageUrl
                )
                clearPendingCard()
                vm.onAction(HomeAction.ConsumeResult)
            }
            is UiState.Error -> {
                navigateToChat(
                    question = question,
                    homeStatementId = pendingStatementId,
                    imageUri = pendingCardImageUrl
                )
                clearPendingCard()
                vm.onAction(HomeAction.ConsumeResult)
            }
            else -> Unit
        }
    }

    private fun clearPendingCard() {
        pendingQuestion = null
        pendingCardImageUrl = null
        pendingStatementId = null
    }

    override fun onSingleSelect(section: SectionDto, option: OptionDto) {
        val uid = userId()
        if (uid.isBlank()) return
        // Gender question card (doc 01 §3.7).
        vmProfile.onAction(
            UserNameAction.UpdateUserName(
                UserNameRequest(user_id = uid, gender = option.id ?: option.text)
            ),
            AnalyticsScreens.HOME
        )
        val genderValue = option.id ?: option.text ?: ""
        // App HomeScreen.kt:1401 — Card_Clicked carries the selection as `Value`.
        graph.analytics.trackHomeCardEvent(
            AnalyticsEvents.CARD_CLICKED,
            section.toHomeCardAnalytics(""),
            value = genderValue
        )
        // App HomeScreen.kt:1407 — `{screen_name, gender}`.
        graph.analytics.track(
            AnalyticsEvents.QUESTION_CARD_DATA_SUBMITTED,
            mapOf(
                AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME,
                AnalyticsProps.GENDER to genderValue
            )
        )
        vm.dismissCard(section.stableId())
        binding.fcHomeToast.show(
            label(
                Labels.THANK_YOU_YOUR_ANSWER_HELPS_US_GIVE_MORE_ACCURATE_ADVICE,
                "Thank you. Your answer helps us give more accurate advice."
            ),
            ToastView.Type.SUCCESS
        )
    }

    override fun onMultiSelectConfirm(section: SectionDto, optionIds: List<String>) {
        val uid = userId()
        if (uid.isBlank() || optionIds.isEmpty()) return
        val isLivestock = section.statement_type?.contains("livestock", ignoreCase = true) == true
        // App HomeScreen.kt:1454 — Card_Clicked carries the selected ids as `Value`.
        graph.analytics.trackHomeCardEvent(
            AnalyticsEvents.CARD_CLICKED,
            section.toHomeCardAnalytics(""),
            value = optionIds.joinToString(",")
        )
        if (isLivestock) {
            vmProfile.onAction(
                UserNameAction.UpdateUserName(
                    UserNameRequest(
                        user_id = uid,
                        live_stock_details = optionIds.map { LiveStockDetail(type = it) }
                    )
                ),
                AnalyticsScreens.HOME
            )
            // App HomeScreen.kt:1492 — `{screen_name, livestock}`.
            graph.analytics.track(
                AnalyticsEvents.QUESTION_CARD_DATA_SUBMITTED,
                mapOf(
                    AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME,
                    AnalyticsProps.LIVESTOCK to optionIds.joinToString(",")
                )
            )
            binding.fcHomeToast.show(
                label(
                    Labels.THANK_YOU_YOUR_ANSWER_HELPS_US_GIVE_MORE_ACCURATE_ADVICE,
                    "Thank you. Your answer helps us give more accurate advice."
                ),
                ToastView.Type.SUCCESS
            )
        } else {
            vm.onAction(HomeAction.UpdateCultivatedCrops(requireContext().applicationContext, uid, optionIds))
        }
        vm.dismissCard(section.stableId())
    }

    override fun onDismiss(section: SectionDto) {
        vm.dismissCard(section.stableId())
    }

    override fun onSsfrWheat() {
        onSsfrClick(
            label(
                Labels.SSFR_WHEAT_QUESTION,
                "What is the recommended quantity of fertiliser for wheat?"
            ),
            "wheat"
        )
    }

    override fun onSsfrMaize() {
        onSsfrClick(
            label(
                Labels.SSFR_MAIZE_QUESTION,
                "What is the recommended quantity of fertiliser for maize?"
            ),
            "maize"
        )
    }

    private fun onSsfrClick(question: String, crop: String) {
        if (!NetworkUtils.isOnline(requireContext())) {
            findNavController().navigate(
                R.id.fc_dest_error,
                NavRoutes.errorArgs(isNetworkError = true, fromScreen = "home_card"),
                NavRoutes.singleTop()
            )
            return
        }
        navigateToChat(question = question, isSSFR = true, ssfrCrop = crop)
    }

    override fun labelFor(key: String, fallback: String): String = label(key, fallback)

    // ------------------------------------------------------------------ weather

    private fun onWeatherClick() {
        if (!NetworkUtils.isOnline(requireContext())) {
            findNavController().navigate(
                R.id.fc_dest_error,
                NavRoutes.errorArgs(isNetworkError = true, fromScreen = "home_weather"),
                NavRoutes.singleTop()
            )
            return
        }
        // App parity (HomeScreen.kt:558/572): ignored while the feed is still loading or another
        // location flow is running.
        if (vm.state.value.homeFeedState is UiState.Loading) return
        graph.analytics.track(
            AnalyticsEvents.WEATHER_FORECAST_VIEWED,
            mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME)
        ) // app HomeScreen.kt:559
        if (graph.locationPromptManager.state.value != LocationPromptState.Idle) return
        val weatherQuestion =
            label(Labels.WHAT_IS_THE_PRESENT_WEATHER, "What is the present weather?")
        if (graph.locationPromptManager.hasStoredLocation()) {
            navigateToChat(question = weatherQuestion, isWeatherAdviceCTA = true)
        } else {
            graph.locationPromptManager.triggerFromWeather {
                if (isAdded) {
                    navigateToChat(question = weatherQuestion, isWeatherAdviceCTA = true)
                }
            }
        }
    }

    // ------------------------------------------------------------------ voice

    private fun onSpeakClick() {
        if (!graph.prefs.getBoolean(SdkPreferences.Keys.ASR_ENABLED, true)) {
            binding.fcHomeToast.show(
                label(
                    Labels.ASR_IS_DISABLED_FOR_YOUR_SELECTED_LANGUAGE,
                    "ASR is disabled for your selected language"
                ),
                ToastView.Type.ERROR
            )
            return
        }
        graph.analytics.track(
            AnalyticsEvents.CHAT_ICON_CLICKED,
            mapOf(
                AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME,
                AnalyticsProps.ICON_TYPE to "Voice"
            )
        )
        overlays?.showVoiceInput()
    }

    private fun transcribeVoice(file: File) {
        val conversationId =
            graph.prefs.getString(SdkPreferences.Keys.NEW_CONVERSATION_ID, "")
        val base64 = AudioRecorder.convertAudioToBase64(file)
        if (conversationId.isBlank() || base64 == null) {
            overlays?.hide()
            binding.fcHomeToast.show(
                label(
                    Labels.NO_AUDIO_RECORDED_OR_CONVERSATION_NOT_STARTED,
                    "No audio recorded or conversation not started"
                ),
                ToastView.Type.ERROR
            )
            return
        }
        pendingAudioFile = file
        voiceMessageReferenceId = UUID.randomUUID().toString()
        overlays?.setVoiceProcessing(true)
        vm.onAction(
            HomeAction.TranscribeAudio(
                context = requireContext().applicationContext,
                conversationId = conversationId,
                query = base64,
                messageReferenceId = voiceMessageReferenceId.orEmpty(),
                audioFormat = AudioRecorder.getAudioFormat(),
                triggeredType = "voice"
            )
        )
    }

    private fun handleTranscriptionState(state: UiState<org.digitalgreen.farmerchat.sdk.core.model.GetVoiceResponse>) {
        val file = pendingAudioFile ?: return
        when (state) {
            is UiState.Success -> {
                pendingAudioFile = null
                overlays?.hide()
                vm.onAction(HomeAction.ClearTranscriptionState)
                val data = state.data
                if (data.isAcceptedTranscription()) {
                    navigateToChat(
                        question = data.heard_input_query.orEmpty(),
                        transcriptionId = data.transcription_id,
                        audioUri = Uri.fromFile(file).toString()
                    )
                } else {
                    binding.fcHomeToast.show(
                        label(
                            Labels.TRANSCRIPTION_UNCLEAR,
                            "Transcription unclear"
                        ),
                        ToastView.Type.ERROR
                    )
                }
            }
            is UiState.Error -> {
                pendingAudioFile = null
                overlays?.hide()
                vm.onAction(HomeAction.ClearTranscriptionState)
                binding.fcHomeToast.show(
                    state.message.ifBlank {
                        label(
                            Labels.TRANSCRIPTION_FAILED_PLEASE_TRY_AGAIN,
                            "Transcription failed. Please try again."
                        )
                    },
                    ToastView.Type.ERROR
                )
            }
            else -> Unit
        }
    }

    // ------------------------------------------------------------------ navigation

    private fun navigateToChat(
        question: String? = null,
        imageUri: String? = null,
        transcriptionId: String? = null,
        audioUri: String? = null,
        preGeneratedAnswer: String? = null,
        followUpQuestions: List<String>? = null,
        homeStatementId: String? = null,
        isWeatherAdviceCTA: Boolean = false,
        isSSFR: Boolean = false,
        ssfrCrop: String? = null,
        contentCardImageUrl: String? = null,
        contentCardTriggerType: String? = null
    ) {
        if (!isAdded) return
        findNavController().navigate(
            R.id.fc_dest_chat,
            NavRoutes.chatArgs(
                source = "home",
                question = question,
                imageUri = imageUri,
                transcriptionId = transcriptionId,
                audioUri = audioUri,
                preGeneratedAnswer = preGeneratedAnswer,
                followUpQuestions = followUpQuestions,
                homeStatementId = homeStatementId,
                isWeatherAdviceCTA = isWeatherAdviceCTA,
                isSSFR = isSSFR,
                ssfrCrop = ssfrCrop,
                contentCardImageUrl = contentCardImageUrl,
                contentCardTriggerType = contentCardTriggerType
            )
        )
    }

    override fun onDestroyView() {
        overlays?.release()
        overlays = null
        // Dismiss the gate's dialogs before the window goes, or they leak across a config change.
        termsGate?.destroy()
        termsGate = null
        super.onDestroyView()
    }
}
