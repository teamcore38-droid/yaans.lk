# Mobile homepage subcategories

Below the existing 640 px homepage breakpoint, each department shows three subcategory tiles in one row. Further configured tiles are available through native horizontal touch scrolling with scroll snapping. A short swipe hint appears when there are more than three tiles. Each department scrolls independently without widening the page.

At 640 px and above, the existing two-column, two-row card and first-four-tile limit remain. The same tile elements are used across breakpoints; extra desktop tiles are hidden. Department and “See all” links are retained. Subcategory links encode their parent and subcategory query values, and React continues to render labels as text. Keyboard users can focus the scrolling region or its links, with visible focus indicators.

This change uses CSS and browser-native scrolling, without a carousel dependency, new API calls, polling, resize listeners or touch handlers. Images retain lazy loading, asynchronous decoding and the existing responsive CDN helpers. Phone image size hints now reflect the smaller three-column tiles. Existing catalog caching and backend security controls are unchanged.

Regression tests cover zero, two, three, four and seven subcategories, later-tile navigation, encoded query values, label escaping and image loading attributes. Chromium journeys check 320/393/639 px phone layouts, a native touch swipe, keyboard access and navigation to a sixth tile, plus the unchanged four-tile 2x2 layout at 640/768/1280 px. Browser checks use the isolated test API with synthetic category response fixtures and block external requests. Run `npm run verify` before release; keep the required CI security scans and exact-commit production gate.
