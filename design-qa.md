# RideRelay design QA

final result: passed

Source: design/activities.png and design/settings.png (1487×1058, including 42px
native title bar). Implementation: design/qa/activities.png and
 design/qa/settings.png, browser CSS viewport 1487×1016; title bar excluded from
web content. Additional 390×844 narrow-window check: design/qa/mobile.png.

The source and rendered captures were opened together for full-view comparison.
Both screens preserve the pale sidebar, teal controls, strong heading hierarchy,
connection row, activity summary/history, separated settings sections and restrained
borders. System sans-serif text remains readable and long paths stay inside inputs.
The implementation uses the user-selected RideRelay name and a Tabler link mark.
Service names are rendered as labels; third-party marketing logos are not embedded.
The source sample metrics differ from deliberately synthetic ten-second test rides.

## Findings and iteration

- P2, resolved: polling replaced unchanged DOM and could lose keyboard focus.
  Commit b927733 compares rendered content before replacing it and restores focus
  on actual changes. Latest browser interaction evidence was captured after reload.
- No remaining P0/P1/P2 layout or interaction issue observed in tested screens.
- P3: typography/icons and service labels are close to the visual direction rather
  than exact reproductions of the generated mockup; bespoke brand assets can be
  added in a later visual iteration.

## Interaction evidence

Activities/settings navigation, details open/close, demo connection check, setting
save plus reload, demo upload refusal and responsive 390px layout were exercised.
Mobile document scroll width was 375px at 390px viewport, without horizontal
content overflow. Browser console check returned no errors or warnings. Native
macOS WebView also displayed the same connected demo activities and settings.

Detail paths wrap within the drawer. A focused-region crop was unnecessary because
full-view captures and the rendered drawer showed labels and controls legibly.
Manual native folder selection and real authentication remain separate runtime
acceptance items, not proven by the visual QA. No live Garmin upload took place.
