(function () {
  "use strict";

  const CONNECTION_STATES = {
    DISABLED: "disabled",
    DISCONNECTED: "disconnected",
    CONNECTING: "connecting",
    AUTHENTICATING: "authenticating",
    CONNECTED: "connected",
    DISCONNECTING: "disconnecting",
    RECONNECTING: "reconnecting",
    AUTHENTICATION_FAILED: "authentication_failed",
    CONNECTION_FAILED: "connection_failed",
    OBS_UNAVAILABLE: "obs_unavailable",
    VERSION_UNSUPPORTED: "version_unsupported",
    ERROR: "error",
  };

  const OUTPUT_TARGETS = {
    PROJECTOR: "projector",
    OBS: "obs",
    BOTH: "both",
    STAGE: "stage",
    ALL: "all",
  };

  const SCENE_FUNCTIONS = [
    { key: "live_camera", label: "Live Camera", icon: "📷" },
    { key: "camera_scripture", label: "Camera + Scripture", icon: "📖" },
    { key: "fullscreen_scripture", label: "Full-Screen Scripture", icon: "📜" },
    { key: "camera_hymn", label: "Camera + Hymn Lyrics", icon: "🎵" },
    { key: "fullscreen_hymn", label: "Full-Screen Hymn", icon: "🎶" },
    { key: "sermon_title", label: "Sermon Title", icon: "✝" },
    { key: "speaker_lower_third", label: "Speaker Lower Third", icon: "👤" },
    { key: "announcement", label: "Announcement", icon: "📢" },
    { key: "video_playback", label: "Video Playback", icon: "▶" },
    { key: "image_display", label: "Image Display", icon: "🖼" },
    { key: "offering", label: "Offering", icon: "💝" },
    { key: "special_music", label: "Special Music", icon: "🎹" },
    { key: "picture_in_picture", label: "Picture-in-Picture", icon: "⊡" },
    { key: "church_logo", label: "Church Logo", icon: "⛪" },
    { key: "holding_screen", label: "Holding Screen", icon: "⏸" },
    { key: "blank_screen", label: "Blank Screen", icon: "■" },
  ];

  const SOURCE_FUNCTIONS = [
    { key: "scripture_browser", label: "VaChinoda Scripture Overlay", overlayRoute: "scripture" },
    { key: "hymn_browser", label: "VaChinoda Hymn Overlay", overlayRoute: "hymn" },
    { key: "lower_third_browser", label: "VaChinoda Lower Third", overlayRoute: "lower-third" },
    { key: "sermon_title_browser", label: "VaChinoda Sermon Title", overlayRoute: "sermon-title" },
    { key: "announcement_browser", label: "VaChinoda Announcement Overlay", overlayRoute: "announcement" },
    { key: "media_source", label: "Media Source", overlayRoute: null },
    { key: "church_logo", label: "Church Logo", overlayRoute: null },
    { key: "background_image", label: "Background Image", overlayRoute: null },
    { key: "camera_source", label: "Camera Source", overlayRoute: null },
    { key: "pip_camera", label: "Picture-in-Picture Camera", overlayRoute: null },
    { key: "clean_feed", label: "Clean Feed", overlayRoute: "clean-feed" },
  ];

  const OVERLAY_ROUTES = [
    { key: "scripture", path: "/obs/scripture", label: "Scripture overlay" },
    { key: "hymn", path: "/obs/hymn", label: "Hymn overlay" },
    { key: "lower-third", path: "/obs/lower-third", label: "Lower third" },
    { key: "sermon-title", path: "/obs/sermon-title", label: "Sermon title" },
    { key: "announcement", path: "/obs/announcement", label: "Announcement" },
    { key: "fullscreen", path: "/obs/fullscreen", label: "Full-screen content" },
    { key: "clean-feed", path: "/obs/clean-feed", label: "Clean feed" },
  ];

  const SCRIPTURE_LAYOUT_PRESETS = [
    { key: "lower_third", label: "Lower third" },
    { key: "upper_third", label: "Upper third" },
    { key: "bottom_center", label: "Bottom centre" },
    { key: "full_width_lower", label: "Full-width lower band" },
    { key: "left_aligned", label: "Left aligned" },
    { key: "right_aligned", label: "Right aligned" },
    { key: "fullscreen", label: "Full-screen scripture" },
  ];

  const TRANSITION_TYPES = [
    { key: "cut", label: "Cut" },
    { key: "fade", label: "Fade" },
    { key: "slide_up", label: "Slide up" },
    { key: "slide_down", label: "Slide down" },
    { key: "slide_left", label: "Slide left" },
    { key: "slide_right", label: "Slide right" },
    { key: "dissolve", label: "Dissolve" },
  ];

  const DEFAULT_OUTPUT_DEFAULTS = {
    bible: "both",
    hymn: "both",
    lower_third: "obs",
    sermon_title: "obs",
    announcement: "both",
    media: "both",
    stage_message: "stage",
  };

  const DEFAULT_OVERLAY_LAYOUTS = {
    scripture: {
      preset: "lower_third",
      maxLines: 4,
      fontSize: 42,
      widthPercent: 88,
      showBackground: true,
      showLogo: false,
      transition: "fade",
      obsLayout: "lower_third",
      projectorLayout: "fullscreen",
    },
    hymn: {
      preset: "fullscreen",
      maxLines: 6,
      fontSize: 48,
      showBackground: false,
      transition: "fade",
      obsLayout: "lower_third",
      projectorLayout: "fullscreen",
    },
    lower_third: {
      preset: "lower_third",
      transition: "slide_up",
      timeoutMs: 0,
    },
    sermon_title: { preset: "center", transition: "fade" },
    announcement: { preset: "lower_third", transition: "fade" },
  };

  const DEFAULT_CONFIRMATIONS = {
    streamStart: true,
    streamStop: true,
    recordStop: true,
    blackout: false,
  };

  const DEFAULT_SETTINGS = {
    enabled: false,
    host: "127.0.0.1",
    port: 4455,
    browserSourcePort: 47823,
    autoConnectOnStart: false,
    autoReconnect: true,
    reconnectIntervalMs: 5000,
    connectionTimeoutMs: 10000,
    outputTarget: OUTPUT_TARGETS.PROJECTOR,
    outputDefaults: { ...DEFAULT_OUTPUT_DEFAULTS },
    sceneMappings: {},
    sourceMappings: {},
    overlayLayouts: JSON.parse(JSON.stringify(DEFAULT_OVERLAY_LAYOUTS)),
    autoSceneOnLive: {},
    confirmations: { ...DEFAULT_CONFIRMATIONS },
    sceneChangePerContent: true,
  };

  const STATE_LABELS = {
    disabled: "OBS Off",
    disconnected: "OBS Disconnected",
    connecting: "OBS Connecting…",
    authenticating: "OBS Authenticating…",
    connected: "OBS Connected",
    disconnecting: "OBS Disconnecting…",
    reconnecting: "OBS Reconnecting…",
    authentication_failed: "OBS Auth Failed",
    connection_failed: "OBS Connection Failed",
    obs_unavailable: "OBS Unavailable",
    version_unsupported: "OBS Version Unsupported",
    error: "OBS Error",
  };

  const FAILURE_STATES = new Set([
    CONNECTION_STATES.ERROR,
    CONNECTION_STATES.AUTHENTICATION_FAILED,
    CONNECTION_STATES.CONNECTION_FAILED,
    CONNECTION_STATES.OBS_UNAVAILABLE,
    CONNECTION_STATES.VERSION_UNSUPPORTED,
  ]);

  const CONTENT_TO_SCENE_KEY = {
    bible: "camera_scripture",
    scripture: "camera_scripture",
    hymn: "camera_hymn",
    lower_third: "speaker_lower_third",
    sermon_title: "sermon_title",
    announcement: "announcement",
    media: "video_playback",
    logo: "church_logo",
    blackout: "blank_screen",
    holding: "holding_screen",
  };

  const CONTENT_TO_SOURCE_KEY = {
    bible: "scripture_browser",
    scripture: "scripture_browser",
    hymn: "hymn_browser",
    lower_third: "lower_third_browser",
    sermon_title: "sermon_title_browser",
    announcement: "announcement_browser",
  };

  window.CISObsConstants = {
    CONNECTION_STATES,
    OUTPUT_TARGETS,
    SCENE_FUNCTIONS,
    SOURCE_FUNCTIONS,
    OVERLAY_ROUTES,
    SCRIPTURE_LAYOUT_PRESETS,
    TRANSITION_TYPES,
    DEFAULT_OUTPUT_DEFAULTS,
    DEFAULT_OVERLAY_LAYOUTS,
    DEFAULT_CONFIRMATIONS,
    DEFAULT_SETTINGS,
    STATE_LABELS,
    FAILURE_STATES,
    CONTENT_TO_SCENE_KEY,
    CONTENT_TO_SOURCE_KEY,
  };
})();
