/* Keep the controlled comparison and its interpretation visible together. */
document.getElementById('comparison-mount').innerHTML = String.raw`
<section id="comparisons" class="content-section comparison-section">
  <p class="section-kicker">Baseline comparisons</p>
  <h2>Compare controllers on the same requested motion</h2>
  <p class="section-intro">The same recorded motion is encoded by each method and supplied to its controller. Compare the executions under the same velocity command and reset seed.</p>
  <div id="matched-methods" class="segmented centered" role="group" aria-label="Controller comparison">
    <button type="button" data-panel="pb_u" aria-pressed="true">CODES vs. without coarse labels</button>
    <button type="button" data-panel="pb_vq" aria-pressed="false">CODES vs. VQ-VAE</button>
  </div>
  <div id="matched-examples" aria-label="Recorded motions for comparison"></div>
  <p id="matched-example-note" class="comparison-command"></p>
  <div id="matched-video-root" class="matched-video-grid"></div>
  <div class="comparison-buttons"><button id="matched-play" type="button">Play all</button><button id="matched-pause" type="button" class="secondary-button">Pause</button></div>
  <p id="matched-playback-status" class="playback-status" aria-live="polite"></p>
  <p class="small-note">The two-second recording loops alongside ten seconds of each simulation execution. Motion phases are not aligned.</p>
  <div class="result-summary">
    <h3>Results across the shared recordings</h3>
    <p id="matched-protocol-count" class="small-note"></p>
    <div id="matched-comparison-table" class="comparison-table-wrap"></div>
    <p id="matched-conclusion" class="result-insight"></p>
    <p class="small-note">Motion distance compares posture and coordination; lower is better. Recording retrieval measures how often the execution is closest to the requested source recording. These are kinematic measures, not perceptual judgments.</p>
    <a class="small-link" href="technical.html#matched">Full metrics, uncertainty, and selection protocol →</a>
  </div>
  <div class="result-summary">
    <h3>Command tracking across all style groups</h3>
    <p>Each method is also tested over the full velocity grid using its own reference collection. The controller without coarse labels has the strongest aggregate command tracking; this alone does not establish better style fidelity.</p>
    <div id="native-comparison-table" class="comparison-table-wrap"></div>
    <a class="small-link" href="technical.html#command">Command-tracking protocol and data →</a>
  </div>
</section>
`;
