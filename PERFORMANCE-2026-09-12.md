# Homepage performance repair

Before: the public homepage creates a live WebGL canvas approximately 3,821 pixels below the viewport and loads the 614,093-byte schedule image before its section is visible. Google Fonts uses display=block. The HTML also embeds a large ignored copy of the 3D source inside a script element that already has src.

Change: defer the 3D module until within 300 pixels of its section; suspend rendering when the preview is outside the viewport or the document is hidden; retain the interactive modal and clean up its observers and animation frame. Remove the ignored inline source, use display=swap, and lazy-load the below-fold schedule image, Revit logo and document-platform images. The latest origin/master canonical URL repair is preserved. No deployment configuration or scripts changed.

Browser verification: initial page has zero preview canvases and the schedule image has naturalWidth 0. After scrolling to the section, the canvas is created and visually renders the MEP model. Clicking opens one modal canvas; Escape closes it and removes that canvas. No console errors observed. Node syntax checks pass for both production modules. Before/after end-user latency is not yet measured; these checks prove deferred work and preserved interaction.

Remaining candidates: the shared animated favicon encodes a PNG approximately 30 times per second; stylesheet payload and oversized image dimensions need broader review. No claim is made that all website performance issues are resolved.
