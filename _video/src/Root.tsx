import { Composition } from "remotion";
import { SpecialClip, type ClipProps } from "./SpecialClip";

export const FPS = 30;

// Sample props for Remotion Studio (`npm run studio`); render.mjs replaces
// these with the real special's data.
const sample: ClipProps = {
  summary:
    "The Brady Bunch Book is filled with stories, photographs, and fun behind-the-scenes details. This delightful book celebrates the beloved television family that brought us bell-bottoms, sibling squabbles, and plenty of groovy adventures.",
  photo: "week/photo.webp",
  cover: null,
  audio: null,
  sticker: null,
  theme: "confetti",
  durationInFrames: 20 * FPS,
};

export const Root: React.FC = () => (
  <Composition
    id="SpecialClip"
    component={SpecialClip}
    width={1080}
    height={1080}
    fps={FPS}
    durationInFrames={sample.durationInFrames}
    defaultProps={sample}
    calculateMetadata={({ props }) => ({ durationInFrames: props.durationInFrames })}
  />
);
