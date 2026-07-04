import Image from "next/image";

export default function AppLoading() {
  return (
    <div className="daystack-loading-screen" role="status" aria-label="Loading DayStack">
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
      <span className="sr-only">Loading DayStack</span>
    </div>
  );
}
