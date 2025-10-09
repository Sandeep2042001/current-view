declare module 'marzipano' {
  export class Viewer {
    constructor(element: HTMLElement, options?: any);
    createScene(options: any): any;
    controls(): any;
    startMovement(movement: any): void;
    stopMovement(): void;
    setIdleMovement(delay: number, movement: any): void;
    dispatchEvent(event: string, data?: any): void;
    destroy(): void;
  }

  export class ImageUrlSource {
    static fromString(url: string, options?: any): any;
  }

  export class EquirectGeometry {
    constructor(levels: any[]);
  }

  export class RectilinearView {
    constructor(params: any, limiter?: any);
    static limit: any;
    setParameters(params: any): void;
  }

  export class HotspotContainer {
    createHotspot(element: HTMLElement, position: any): void;
  }

  export function autorotate(options: any): any;
  export function registerDefaultControls(viewer: any): void;
  export function registerDefaultRenderers(viewer: any): void;

  export namespace View {
    export const ControlType: any;
  }

  export namespace Viewer {
    export const ControlType: any;
  }
}

