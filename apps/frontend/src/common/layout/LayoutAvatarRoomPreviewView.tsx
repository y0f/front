import { RoomPreviewer } from "@nitro/renderer";
import { FC, useEffect, useRef, useState } from "react";

import { GetRoomEngine } from "../../api";
import { Base, BaseProps } from "../Base";
import { LayoutRoomPreviewerView } from "./LayoutRoomPreviewerView";

/**
 * A component that uses RoomPreviewer to display an avatar with effects.
 * This provides proper effect rendering by leveraging the room engine's
 * avatar rendering system.
 */
export interface LayoutAvatarRoomPreviewViewProps extends BaseProps<HTMLDivElement> {
  figure: string;
  gender?: string;
  direction?: number;
  effect?: number;
  scale?: number;
  height?: number;
}

export const LayoutAvatarRoomPreviewView: FC<LayoutAvatarRoomPreviewViewProps> = props => {
  const {
    figure = "",
    gender = "M",
    direction = 4,
    effect = -1,
    scale = 1,
    height = 150,
    classNames = [],
    style = {},
    ...rest
  } = props;

  const [roomPreviewer, setRoomPreviewer] = useState<RoomPreviewer>(null);
  const previewerIdRef = useRef<number>(Math.floor(Math.random() * 10000) + 1);
  const isDisposed = useRef(false);

  // Initialize room previewer
  useEffect(() => {
    isDisposed.current = false;

    const roomEngine = GetRoomEngine();
    if (!roomEngine) return;

    // Create a new room previewer with a unique ID
    const previewer = new RoomPreviewer(roomEngine, previewerIdRef.current);
    
    // Add avatar to the preview room
    previewer.addAvatarIntoRoom(figure, effect > 0 ? effect : 0);
    
    setRoomPreviewer(previewer);

    return () => {
      isDisposed.current = true;
      if (previewer) {
        previewer.reset(true);
        // Note: RoomPreviewer doesn't have a dispose method, but reset(true) cleans up
      }
    };
  }, []); // Only create once on mount

  // Update avatar figure when it changes
  useEffect(() => {
    if (!roomPreviewer || isDisposed.current) return;

    roomPreviewer.updateObjectUserFigure(figure, gender);
  }, [figure, gender, roomPreviewer]);

  // Update avatar direction when it changes
  useEffect(() => {
    if (!roomPreviewer || isDisposed.current) return;

    // Convert direction (0-7) to degrees (0-315)
    const directionDegrees = direction * 45;
    roomPreviewer.updateAvatarDirection(direction, direction);
  }, [direction, roomPreviewer]);

  // Update effect when it changes
  useEffect(() => {
    if (!roomPreviewer || isDisposed.current) return;

    // Update the avatar's effect
    if (effect > 0) {
      roomPreviewer.updateUserEffect(effect);
    } else {
      // Remove effect by setting to 0
      roomPreviewer.updateUserEffect(0);
    }
  }, [effect, roomPreviewer]);

  if (!roomPreviewer) {
    return <Base classNames={["avatar-preview-loading"]} style={style} {...rest} />;
  }

  return (
    <div className="avatar-room-preview-container" style={{ transform: scale !== 1 ? `scale(${scale})` : undefined }}>
      <LayoutRoomPreviewerView roomPreviewer={roomPreviewer} height={height} />
    </div>
  );
};
