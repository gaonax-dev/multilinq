/**
 * Screen Wake Lock 유틸리티
 * 번역 작업 중 화면이 잠기지 않도록 유지
 */

let wakeLock: WakeLockSentinel | null = null;

/**
 * Wake Lock 획득
 */
export async function requestWakeLock(): Promise<boolean> {
  if (typeof window === "undefined" || !("wakeLock" in navigator)) {
    console.warn("Wake Lock API를 지원하지 않습니다.");
    return false;
  }

  try {
    // @ts-ignore - Wake Lock API 타입 정의가 없을 수 있음
    wakeLock = await navigator.wakeLock.request("screen");
    console.log("Wake Lock 획득 성공");
    return true;
  } catch (error) {
    console.error("Wake Lock 획득 실패:", error);
    return false;
  }
}

/**
 * Wake Lock 해제
 */
export async function releaseWakeLock(): Promise<void> {
  if (wakeLock) {
    try {
      await wakeLock.release();
      wakeLock = null;
      console.log("Wake Lock 해제 성공");
    } catch (error) {
      console.error("Wake Lock 해제 실패:", error);
      wakeLock = null;
    }
  }
}

/**
 * Wake Lock 상태 확인
 */
export function isWakeLockActive(): boolean {
  return wakeLock !== null;
}
