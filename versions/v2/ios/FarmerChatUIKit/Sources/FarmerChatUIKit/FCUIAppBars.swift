#if canImport(UIKit)
import UIKit
import FarmerChatCore

// The app's own bars for the UIKit flavour (fc-compose-agentic components/appbars/): every
// screen draws its bar itself and the navigation controller's system bar stays hidden — the app
// has no system/Material top bar anywhere. Before this, Home, Recent chats, Settings, Name,
// Choose your language, Help and Sign up showed a standard UINavigationBar (the 1.0 chrome).

// MARK: - App bar (DefaultAppBar.kt / HomeAppBar.kt)

/// DefaultAppBar.kt: solid `brand.surfacePrimary` `64 + status inset` tall (edge to edge), a
/// 16pt-padded row of [42pt left ActionButton | centred white titleMedium | 42pt right slot].
/// `glow` adds the 80pt yellow bloom (every call site in the app passes `showGlow = false` except
/// No Internet). HomeAppBar.kt is the same row at 52pt with the menu tile left and the weather
/// pill right, and no background on the composer Home (the band behind supplies the green).
final class FCUIAppBar: UIView {
    private let titleLabel = UILabel()
    private let glow = CAGradientLayer()
    private let showGlow: Bool

    var title: String? {
        get { titleLabel.text }
        set {
            titleLabel.text = newValue
            titleLabel.accessibilityLabel = newValue
        }
    }

    init(title: String?, left: UIView?, right: UIView?, height: CGFloat = 64, background: Bool = true, glow: Bool = false) {
        showGlow = glow
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = background ? FCUITheme.brandSurfacePrimary : .clear

        if glow {
            self.glow.type = .radial
            let sun = FCUITheme.sun300
            self.glow.colors = [0.5, 0.37, 0.25, 0.12, 0].map { sun.withAlphaComponent($0).cgColor }
            self.glow.locations = [0, 0.25, 0.5, 0.75, 1]
            layer.addSublayer(self.glow)
        }

        let row = UILayoutGuide()
        addLayoutGuide(row)
        let leftView = left ?? Self.spacer()
        let rightView = right ?? Self.spacer()
        leftView.translatesAutoresizingMaskIntoConstraints = false
        rightView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(leftView)
        addSubview(rightView)

        titleLabel.text = title
        titleLabel.font = FCUITypography.current.titleMedium.font
        titleLabel.textColor = .white
        titleLabel.textAlignment = .center
        titleLabel.adjustsFontForContentSizeCategory = true
        titleLabel.accessibilityTraits = .header
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(titleLabel)
        // The side actions keep their own width (the weather pill must not stretch into an empty
        // title's space); the title takes what is left.
        for side in [leftView, rightView] {
            side.setContentHuggingPriority(.required, for: .horizontal)
            side.setContentCompressionResistancePriority(.required, for: .horizontal)
        }
        titleLabel.setContentHuggingPriority(UILayoutPriority(1), for: .horizontal)
        titleLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)

        NSLayoutConstraint.activate([
            row.topAnchor.constraint(equalTo: safeAreaLayoutGuide.topAnchor),
            row.bottomAnchor.constraint(equalTo: bottomAnchor),
            row.heightAnchor.constraint(equalToConstant: height),
            row.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            row.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            leftView.leadingAnchor.constraint(equalTo: row.leadingAnchor),
            leftView.centerYAnchor.constraint(equalTo: row.centerYAnchor),
            rightView.trailingAnchor.constraint(equalTo: row.trailingAnchor),
            rightView.centerYAnchor.constraint(equalTo: row.centerYAnchor),
            titleLabel.leadingAnchor.constraint(equalTo: leftView.trailingAnchor, constant: 8),
            titleLabel.trailingAnchor.constraint(equalTo: rightView.leadingAnchor, constant: -8),
            titleLabel.centerYAnchor.constraint(equalTo: row.centerYAnchor)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func layoutSubviews() {
        super.layoutSubviews()
        guard showGlow else { return }
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        glow.frame = CGRect(x: 0, y: 0, width: bounds.width, height: 80)
        glow.startPoint = CGPoint(x: 0.5, y: 0)
        glow.endPoint = CGPoint(x: 1, y: 1)
        CATransaction.commit()
    }

    /// The 42pt spacer that keeps the title centred when a side has no action.
    static func spacer() -> UIView {
        let v = UIView()
        v.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            v.widthAnchor.constraint(equalToConstant: 42),
            v.heightAnchor.constraint(equalToConstant: 42)
        ])
        return v
    }
}

/// The DefaultAppBar left action, as each screen passes it.
@MainActor
enum FCUIAppBarLeading {
    /// Hamburger, round (`leftRadius = Radius.Rounded`) — Recent chats, Settings, Language, Help.
    case menu
    /// Icons.AutoMirrored.Filled.ArrowBack, the default 12pt square — Settings › Name.
    case back
    /// Close, round — Sign up, country picker, legal pages.
    case close

    var symbol: String {
        switch self {
        case .menu: return "line.3.horizontal"
        case .back: return "arrow.left"
        case .close: return "xmark"
        }
    }

    var radius: CGFloat { self == .back ? 12 : 21 }

    var accessibilityLabel: String {
        switch self {
        case .menu: return "menu"
        case .back: return "Back"
        case .close: return fcuiLabel(FCLabels.close, "Close")
        }
    }
}

extension UIViewController {
    /// Installs a DefaultAppBar at the top of `view` (edge to edge) and returns it; lay content out
    /// from its `bottomAnchor`. The navigation controller's system bar is hidden by
    /// ``FarmerChatViewController`` for every screen.
    @discardableResult
    func fcuiInstallAppBar(title: String?, leading: FCUIAppBarLeading?, action: @escaping () -> Void) -> FCUIAppBar {
        var left: UIView?
        if let leading {
            let tile = FCUIHeaderTile(
                systemImage: leading.symbol,
                accessibilityLabel: leading.accessibilityLabel,
                identifier: "fcAppBarLeading",
                radius: leading.radius
            )
            tile.addAction(UIAction { _ in action() }, for: .touchUpInside)
            left = tile
        }
        let bar = FCUIAppBar(title: title, left: left, right: nil)
        view.addSubview(bar)
        NSLayoutConstraint.activate([
            bar.topAnchor.constraint(equalTo: view.topAnchor),
            bar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bar.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
        return bar
    }

    /// Drawer screens (Recent chats, Settings, Language, Help): the menu tile opens the drawer;
    /// with the drawer off (CHAT_ONLY) they were pushed from chat, so the tile goes back instead.
    func fcuiDrawerScreenLeading(route: String) -> (FCUIAppBarLeading, () -> Void) {
        if FarmerChat.shared.config.showDrawer {
            return (.menu, { [weak self] in
                FarmerChat.shared.analytics.track(AnalyticsEvents.hamburgerMenuClicked)
                (self?.navigationController as? FarmerChatViewController)?.openDrawer(currentRoute: route)
            })
        }
        return (.back, { [weak self] in self?.fcuiGoBack() })
    }

    /// Back / close for a pushed or presented screen.
    func fcuiGoBack() {
        if let nav = navigationController, nav.viewControllers.first !== self {
            nav.popViewController(animated: true)
        } else {
            dismiss(animated: true)
        }
    }
}

// MARK: - Table screens

/// A plain view controller hosting a table under a DefaultAppBar. Replaces UITableViewController
/// for the drawer screens: a table controller's root view IS the table, so a fixed bar could only
/// be faked with a scrolling header or the system navigation bar.
class FCUITableScreen: UIViewController, UITableViewDataSource, UITableViewDelegate {
    let tableView: UITableView
    private(set) var appBar: FCUIAppBar!

    override var title: String? {
        didSet { appBar?.title = title }
    }

    init(style: UITableView.Style) {
        tableView = UITableView(frame: .zero, style: style)
        super.init(nibName: nil, bundle: nil)
    }

    /// The bar's left action; subclasses override.
    func appBarLeading() -> (FCUIAppBarLeading, () -> Void)? { nil }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = FCUITheme.surfacePrimary
        tableView.dataSource = self
        tableView.delegate = self
        tableView.backgroundColor = FCUITheme.surfacePrimary
        tableView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(tableView)
        let leading = appBarLeading()
        appBar = fcuiInstallAppBar(title: title, leading: leading?.0, action: leading?.1 ?? {})
        NSLayoutConstraint.activate([
            tableView.topAnchor.constraint(equalTo: appBar.bottomAnchor),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    func numberOfSections(in tableView: UITableView) -> Int { 1 }
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int { 0 }
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell { UITableViewCell() }
    func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? { nil }
    func tableView(_ tableView: UITableView, titleForFooterInSection section: Int) -> String? { nil }
    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {}
    func tableView(_ tableView: UITableView, willDisplay cell: UITableViewCell, forRowAt indexPath: IndexPath) {}
}
#endif
