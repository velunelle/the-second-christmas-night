Validation of this revision:

- All 58 JavaScript modules parse; all relative module imports resolve; git diff whitespace checks pass.
- Browser CPU build: 522 walkers, 202 stationary people (38 additional market visitors/vendors), 6 population draw batches. Sample at (0,-120) has 531 visible people.
- Pedestrian matrices are finite, and their world positions do not shift when only the viewer moves. Rain/snow umbrella counts differ as intended.
- Vehicle batching: 109 original mesh components consolidated into 23 material/layout batches. Original and combined geometry both contain 213,347 triangles per car; bounding size remains approximately 2.801 × 1.266 × 4.8 metres. All instance matrices are finite.
- Sky: separate 2,665-vertex moon sphere and 1,800-point star field. Rain/snow cloud coverage uniforms switch 1/0. Cloud appearance uses a procedural atmosphere shader, not volumetric cloud geometry.
- Offline Web Audio render: 5 positioned conversation sources plus traffic and shop bell; finite nonzero output, peak below clipping (sample peak .0575, RMS .0112).
- UI harness: default ratio 3, full reflection resolution, shadow 8192, reflection every frame. Selecting reflection 30 fps retains ratio 3 and full reflection resolution; ratio 8 remains selectable independently.
- Fixed EffectComposer logical dimensions before adding passes, eliminating temporary repeated DPR multiplication during startup.
- Verification limit: cloud browser reports GL_VENDOR and GL_RENDERER Disabled. Live WebGL shader compilation, visual appearance, device FPS and audible listening have not been verified. CPU geometry, offline audio generation and UI checks do not establish final rendered quality.
