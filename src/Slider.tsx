import { Slider as ArcSlider } from "@ark-ui/solid/slider";

export interface SliderProps {
  class?: string;
  label: string;
  min: number;
  max: number;
  step?: number;
}

export function Slider(props: SliderProps) {
  return (
    <ArcSlider.Root
      class={`flex-col ${props.class}`}
      step={props.step}
      min={props.min}
      max={props.max}
    >
      <div class="flex justify-between">
        <ArcSlider.Label>{props.label}</ArcSlider.Label>
        <ArcSlider.ValueText />
      </div>
      <ArcSlider.Control class="mt-0.5 border-1 border-fg-2 h-5 rounded-md">
        <ArcSlider.Track>
          <ArcSlider.Range />
        </ArcSlider.Track>
        <ArcSlider.Thumb
          class="w-4.5 h-4.5 bg-highlight-2 rounded-md"
          index={0}
        >
          <ArcSlider.HiddenInput />
        </ArcSlider.Thumb>
      </ArcSlider.Control>
    </ArcSlider.Root>
  );
}
