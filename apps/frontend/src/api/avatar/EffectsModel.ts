import { AvatarEditorFigureCategory } from "@nitro/renderer";

import { GetPixelEffectIcon } from "../catalog/CatalogUtilities";
import { CategoryBaseModel } from "./CategoryBaseModel";
import { CategoryData } from "./CategoryData";
import { AvatarEditorGridPartItem } from "./AvatarEditorGridPartItem";
import { AvatarEditorUtilities } from "./AvatarEditorUtilities";

// Custom effect part item for handling effects without real part sets
class EffectPartItem extends AvatarEditorGridPartItem {
  private _effectId: number;
  private _effectImageUrl: string;

  constructor(effectId: number, isClear: boolean = false) {
    super(null, null, false, false);
    this._effectId = effectId;
    this.isClear = isClear;
    
    // Set the image URL for the effect icon
    if (!isClear && effectId > 0) {
      this._effectImageUrl = GetPixelEffectIcon(effectId);
    }
  }

  public get id(): number {
    return this._effectId;
  }

  public get imageUrl(): string {
    return this._effectImageUrl || super.imageUrl;
  }
}

export class EffectsModel extends CategoryBaseModel {
  private static _availableEffects: number[] = [];

  public static setAvailableEffects(effects: number[]): void {
    EffectsModel._availableEffects = effects;
  }

  public init(): void {
    super.init();

    // Effects don't use traditional figure parts, so we create a custom category
    this.createEffectsCategory();
    
    this._isInitalized = true;
  }

  private createEffectsCategory(): void {
    const partItems: AvatarEditorGridPartItem[] = [];
    const colorItems: any[][] = [[], []]; // Effects don't use colors but the structure expects it

    // Add "None" option (ID 0)
    const noneItem = new EffectPartItem(0, true);
    partItems.push(noneItem);

    // Add available effects from static property or default sample effects
    const effectsToAdd = EffectsModel._availableEffects.length > 0 
      ? EffectsModel._availableEffects 
      : [];
    
    for (const effectId of effectsToAdd) {
      if (effectId > 0) { // Don't add effect 0 twice
        const effectItem = new EffectPartItem(effectId, false);
        partItems.push(effectItem);
      }
    }

    const categoryData = new CategoryData("effects_icon", partItems, colorItems);
    
    if (!this._categories) {
      this._categories = new Map();
    }
    
    this._categories.set("effects_icon", categoryData);

    // Pre-select the current effect if available
    if (AvatarEditorUtilities.CURRENT_FIGURE && AvatarEditorUtilities.CURRENT_FIGURE.avatarEffectType > 0) {
      this.selectEffectById(AvatarEditorUtilities.CURRENT_FIGURE.avatarEffectType);
    } else if (categoryData.parts.length > 0) {
      // Set the current selection to "None" by default
      categoryData.selectPartIndex(0);
    }
  }

  public selectEffectById(effectId: number): void {
    const categoryData = this._categories.get("effects_icon");
    if (!categoryData) return;

    // Find the part with the matching effect ID
    const partIndex = categoryData.parts.findIndex(part => part.id === effectId);
    if (partIndex !== -1) {
      categoryData.selectPartIndex(partIndex);
      console.log("Pre-selected effect:", effectId, "at index:", partIndex);
    }
  }

  public selectPart(category: string, partIndex: number): void {
    const categoryData = this._categories.get(category);
    
    if (!categoryData) return;

    categoryData.selectPartIndex(partIndex);
    
    const partItem = categoryData.getCurrentPart();
    
    if (!partItem) return;
    console.log("Selected effect part:", partItem.id);

    const effectId = partItem.isClear ? 0 : partItem.id;

    // For effects, we set the avatarEffectType directly instead of using figure parts
    if (AvatarEditorUtilities.CURRENT_FIGURE) {
      AvatarEditorUtilities.CURRENT_FIGURE.avatarEffectType = effectId;
      AvatarEditorUtilities.CURRENT_FIGURE.updateView(); // Trigger preview update
    }
    
    // Notify the main component about effect selection
    if (AvatarEditorUtilities.ON_EFFECT_SELECTED) {
      AvatarEditorUtilities.ON_EFFECT_SELECTED(effectId);
    }
  }

  public selectColor(): void {
    // Effects don't use colors, so this is a no-op
  }

  public get name(): string {
    return AvatarEditorFigureCategory.EFFECTS;
  }
}