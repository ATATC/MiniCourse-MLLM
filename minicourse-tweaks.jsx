// Tweaks for MiniCourse — MLLM site
const MINICOURSE_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#2a6fdb",
  "headingFont": "Sans (Lato)",
  "bodySize": 17
}/*EDITMODE-END*/;

function MiniCourseTweaks() {
  const [t, setTweak] = useTweaks(MINICOURSE_TWEAK_DEFAULTS);

  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', t.accent);
    root.style.setProperty('--accent-dark', `color-mix(in srgb, ${t.accent} 78%, black)`);
    root.style.setProperty(
      '--heading-font',
      t.headingFont === 'Serif'
        ? "'Source Serif 4', Georgia, serif"
        : "'Lato', 'Helvetica Neue', Helvetica, Arial, sans-serif"
    );
    document.body.style.fontSize = t.bodySize + 'px';
  }, [t]);

  return (
    <TweaksPanel>
      <TweakSection label="Theme" />
      <TweakColor
        label="Accent"
        value={t.accent}
        options={['#2a6fdb', '#0e7c7b', '#9d3c50']}
        onChange={(v) => setTweak('accent', v)}
      />
      <TweakSection label="Typography" />
      <TweakRadio
        label="Headings"
        value={t.headingFont}
        options={['Sans (Lato)', 'Serif']}
        onChange={(v) => setTweak('headingFont', v)}
      />
      <TweakSlider
        label="Body size"
        value={t.bodySize}
        min={15}
        max={20}
        step={0.5}
        unit="px"
        onChange={(v) => setTweak('bodySize', v)}
      />
    </TweaksPanel>
  );
}

(function mountMiniCourseTweaks() {
  const host = document.createElement('div');
  host.id = 'tweaks-root';
  document.body.appendChild(host);
  ReactDOM.createRoot(host).render(<MiniCourseTweaks />);
})();
