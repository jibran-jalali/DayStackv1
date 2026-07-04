import Image from "next/image";

export default function AppLoading() {
  return (
    <div className="daystack-loading-screen" role="status" aria-label="Loading DayStack">
      <div className="daystack-loading-orb daystack-loading-orb--one" />
      <div className="daystack-loading-orb daystack-loading-orb--two" />

      <div className="daystack-loading-card">
        <div className="daystack-loading-topbar">
          <span />
          <span />
          <span />
          <div />
        </div>

        <div className="daystack-loading-content">
          <div className="daystack-loading-brand">
            <div className="daystack-loading-logo">
              <Image
                src="/brand/daystack-mark.png"
                alt=""
                width={512}
                height={512}
                priority
                className="daystack-loading-logo__mark"
              />
            </div>
            <div>
              <p className="daystack-loading-eyebrow">DayStack</p>
              <h1>Preparing your timeline</h1>
            </div>
          </div>

          <div className="daystack-loading-progress">
            <span />
          </div>

          <div className="daystack-loading-preview" aria-hidden="true">
            <div className="daystack-loading-time">9 AM</div>
            <div className="daystack-loading-block daystack-loading-block--focus">
              <strong>Focus block</strong>
              <small>Deep work</small>
            </div>
            <div className="daystack-loading-time">1 PM</div>
            <div className="daystack-loading-block daystack-loading-block--ai">
              <strong>DayStack AI</strong>
              <small>Optimizing schedule</small>
            </div>
            <div className="daystack-loading-time">4 PM</div>
            <div className="daystack-loading-block daystack-loading-block--done">
              <strong>Next move</strong>
              <small>Ready</small>
            </div>
          </div>
        </div>
      </div>

      <span className="sr-only">Loading DayStack</span>
    </div>
  );
}
