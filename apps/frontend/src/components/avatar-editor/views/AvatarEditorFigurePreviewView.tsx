import {AvatarDirectionAngle, AvatarEditorFigureCategory} from "@nitro/renderer";
import {FC, useEffect, useState} from "react";

import {FigureData} from "../../../api";
import {Base, Column, LayoutAvatarImageView, LayoutAvatarRoomPreviewView} from "../../../common";

export interface AvatarEditorFigurePreviewViewProps {
  figureData: FigureData;
  activeCategory?: string;
  onFigureUpdate?: () => void;
}

export const AvatarEditorFigurePreviewView: FC<AvatarEditorFigurePreviewViewProps> = props => {
  const {figureData = null, activeCategory = null, onFigureUpdate = null} = props;
  const [updateId, setUpdateId] = useState(-1);

  const rotateFigure = (direction: number) => {
    if (direction < AvatarDirectionAngle.MIN_DIRECTION) {
      direction = AvatarDirectionAngle.MAX_DIRECTION + (direction + 1);
    }

    if (direction > AvatarDirectionAngle.MAX_DIRECTION) {
      direction = direction - (AvatarDirectionAngle.MAX_DIRECTION + 1);
    }

    figureData.direction = direction;
  };

  useEffect(() => {
    if (!figureData) return;

    figureData.notify = () => {
      setUpdateId(prevValue => prevValue + 1);
      // Call parent's onFigureUpdate callback if provided
      if (onFigureUpdate) onFigureUpdate();
    };

    return () => {
      figureData.notify = null;
    };
  }, [figureData, onFigureUpdate]);

  // Check if we're in the effects tab
  const isEffectsTab = activeCategory === AvatarEditorFigureCategory.EFFECTS;

  return (
    <Column className="figure-preview-container" overflow="hidden" position="relative">
      {isEffectsTab ? (
        // Use RoomPreview for effects tab to properly render effects
        <LayoutAvatarRoomPreviewView
          key={`avatar-room-${figureData.getFigureString()}-${figureData.direction}-${figureData.avatarEffectType}-${updateId}`}
          figure={figureData.getFigureString()}
          gender={figureData.gender}
          direction={figureData.direction}
          effect={figureData.avatarEffectType}
          scale={1}
          height={150}
        />
      ) : (
        // Use static avatar view for non-effects tabs
        <>
          <LayoutAvatarImageView
            key={`avatar-static-${figureData.getFigureString()}-${figureData.direction}-${updateId}`}
            figure={figureData.getFigureString()}
            direction={figureData.direction}
            scale={2}
          />
          <Base className="avatar-shadow" />
        </>
      )}
      <Base className="arrow-container">
        <i className="icon arrow-left" onClick={event => rotateFigure(figureData.direction + 1)} />
      </Base>
    </Column>
  );
};

