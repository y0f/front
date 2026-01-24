import {
  AvatarEditorFigureCategory,
  AvatarEffectActivatedEvent,
  AvatarEffectAddedEvent,
  AvatarEffectExpiredEvent,
  AvatarEffectSelectedComposer,
  AvatarEffectsEvent,
  FigureSetIdsMessageEvent,
  GetWardrobeMessageComposer,
  IAvatarFigureContainer,
  ILinkEventTracker,
  SetClothingChangeDataMessageComposer,
  UserFigureComposer,
  UserWardrobePageEvent,
} from "@nitro/renderer";
import {FC, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {FaDice, FaTrash, FaUndo} from "react-icons/fa";

import {
  AddEventLinkTracker,
  AvatarEditorAction,
  AvatarEditorUtilities,
  BodyModel,
  EffectsModel,
  FigureData,
  GetAvatarRenderManager,
  GetClubMemberLevel,
  GetConfiguration,
  GetSessionDataManager,
  HeadModel,
  IAvatarEditorCategoryModel,
  LegModel,
  LocalizeText,
  RemoveLinkEventTracker,
  SendMessageComposer,
  SetLocalStorage,
  TorsoModel,
  generateRandomFigure,
} from "../../api";
import {
  Button,
  ButtonGroup,
  Column,
  Flex,
  Grid,
  NitroCardContentView,
  NitroCardHeaderView,
  NitroCardTabsItemView,
  NitroCardTabsView,
  NitroCardView,
  Text,
} from "../../common";
import {useMessageEvent} from "../../hooks";
import {AvatarEditorFigurePreviewView} from "./views/AvatarEditorFigurePreviewView";
import {AvatarEditorModelView} from "./views/AvatarEditorModelView";
import {AvatarEditorWardrobeView} from "./views/AvatarEditorWardrobeView";

const DEFAULT_MALE_FIGURE: string = "hr-100.hd-180-7.ch-215-66.lg-270-79.sh-305-62.ha-1002-70.wa-2007";
const DEFAULT_FEMALE_FIGURE: string = "hr-515-33.hd-600-1.ch-635-70.lg-716-66-62.sh-735-68";

export const AvatarEditorView: FC<{}> = props => {
  const [isVisible, setIsVisible] = useState(false);
  const [figures, setFigures] = useState<Map<string, FigureData>>(null);
  const [figureData, setFigureData] = useState<FigureData>(null);
  const [categories, setCategories] = useState<Map<string, IAvatarEditorCategoryModel>>(null);
  const [activeCategory, setActiveCategory] = useState<IAvatarEditorCategoryModel>(null);
  const [figureSetIds, setFigureSetIds] = useState<number[]>([]);
  const [boundFurnitureNames, setBoundFurnitureNames] = useState<string[]>([]);
  const [savedFigures, setSavedFigures] = useState<[IAvatarFigureContainer, string][]>([]);
  const [isWardrobeVisible, setIsWardrobeVisible] = useState(false);
  const [lastFigure, setLastFigure] = useState<string>(null);
  const [lastGender, setLastGender] = useState<string>(null);
  const [lastEffectId, setLastEffectId] = useState<number>(-1);
  const [needsReset, setNeedsReset] = useState(true);
  const [isInitalized, setIsInitalized] = useState(false);
  const [genderFootballGate, setGenderFootballGate] = useState<string>(null);
  const [objectFootballGate, setObjectFootballGate] = useState<number>(null);
  const [availableEffects, setAvailableEffects] = useState<Map<number, {duration: number, secondsLeftIfActive: number, isPermanent: boolean}>>(new Map());
  const [activeEffectId, setActiveEffectId] = useState<number>(0); // Currently active effect (actually running/counting down)
  const [selectedEffectId, setSelectedEffectId] = useState<number>(0); // Selected in UI for preview/display
  
  // Use ref to avoid stale closure issues in callbacks
  const updateEffectStateRef = useRef<typeof updateEffectState>();

  const DEFAULT_MALE_FOOTBALL_GATE =
    JSON.parse(window.localStorage.getItem("nitro.look.footballgate.M")) || "ch-3109-92-1408.lg-3116-82-1408.sh-3115-1408-1408";
  const DEFAULT_FEMALE_FOOTBALL_GATE =
    JSON.parse(window.localStorage.getItem("nitro.look.footballgate.F")) || "ch-3112-1408-1408.lg-3116-71-1408.sh-3115-1408-1408";
  const maxWardrobeSlots = useMemo(() => GetConfiguration<number>("avatar.wardrobe.max.slots", 10), []);

  // Helper function to manage effect state transitions
  const updateEffectState = useCallback((options: {
    effectId?: number;
    isActive?: boolean;
    isSelected?: boolean;
    clearFigure?: boolean;
  }) => {
    const { effectId = 0, isActive = false, isSelected = false, clearFigure = false } = options;
    
    if (isActive) setActiveEffectId(effectId);
    if (isSelected) setSelectedEffectId(effectId);
    
    if (figureData) {
      if (clearFigure || effectId === 0) {
        figureData.avatarEffectType = 0;
      } else if (isActive || isSelected) {
        figureData.avatarEffectType = effectId;
      }
    }
  }, [figureData]);
  
  // Keep ref updated for stable callbacks
  updateEffectStateRef.current = updateEffectState;
  
  // Update ref whenever callback changes
  updateEffectStateRef.current = updateEffectState;

  const onClose = () => {
    setGenderFootballGate(null);
    setObjectFootballGate(null);
    setIsVisible(false);
  };

  useMessageEvent<FigureSetIdsMessageEvent>(FigureSetIdsMessageEvent, event => {
    const parser = event.getParser();

    setFigureSetIds(parser.figureSetIds);
    setBoundFurnitureNames(parser.boundsFurnitureNames);
  });

  useMessageEvent<UserWardrobePageEvent>(UserWardrobePageEvent, event => {
    const parser = event.getParser();
    const savedFigures: [IAvatarFigureContainer, string][] = [];

    let i = 0;

    while (i < maxWardrobeSlots) {
      savedFigures.push([null, null]);

      i++;
    }

    for (let [index, [look, gender]] of parser.looks.entries()) {
      const container = GetAvatarRenderManager().createFigureContainer(look);

      savedFigures[index - 1] = [container, gender];
    }

    setSavedFigures(savedFigures);
  });

  useMessageEvent<AvatarEffectsEvent>(AvatarEffectsEvent, event => {
    const effects = event.getParser().effects;

    // Update EffectsModel with available effects
    if (effects && effects.length > 0) {
      const effectIds = effects.map((effect: any) => effect.type as number);
      EffectsModel.setAvailableEffects(effectIds);

      // Store effect metadata for later lookup
      const effectsMap = new Map<number, {duration: number, secondsLeftIfActive: number, isPermanent: boolean}>();
      effects.forEach((effect: any) => {
        effectsMap.set(effect.type, {
          duration: effect.duration,
          secondsLeftIfActive: effect.secondsLeftIfActive,
          isPermanent: effect.isPermanent
        });
      });
      setAvailableEffects(effectsMap);

      // Check if there's an active effect and update its details
      const activeEffect = effects.find((effect: any) => effect.secondsLeftIfActive > 0);
      if (activeEffect) {
        updateEffectState({ effectId: activeEffect.type, isActive: true, isSelected: true });
        setLastEffectId(activeEffect.type); // Save as last effect for persistence
      } else {
        // No active effect
        updateEffectState({ effectId: 0, clearFigure: true });
      }

      // Reset categories AFTER setting the active effect so it can be pre-selected
      resetCategories();
    }
  });

  useMessageEvent<AvatarEffectAddedEvent>(AvatarEffectAddedEvent, event => {
    const parser = event.getParser();
    
    // Add the new effect to our available effects map
    setAvailableEffects(prevMap => {
      const newMap = new Map(prevMap);
      newMap.set(parser.type, {
        duration: parser.duration,
        secondsLeftIfActive: 0, // New effects start inactive
        isPermanent: parser.isPermanent
      });
      return newMap;
    });
    
    // Update EffectsModel with the new effect
    const currentEffects = Array.from(availableEffects.keys());
    if (!currentEffects.includes(parser.type)) {
      EffectsModel.setAvailableEffects([...currentEffects, parser.type]);
    }
    
    // Refresh the effects list from server
    resetCategories();
  });

  useMessageEvent<AvatarEffectActivatedEvent>(AvatarEffectActivatedEvent, event => {
    const parser = event.getParser();
    const effectId = parser.type;
    
    // Update the availableEffects map - preserve existing secondsLeftIfActive if it exists
    setAvailableEffects(prevMap => {
      const newMap = new Map(prevMap);
      const existingEffect = prevMap.get(effectId);
      
      const finalSecondsLeft = existingEffect?.secondsLeftIfActive || parser.duration;
      
      newMap.set(effectId, {
        duration: parser.duration,
        secondsLeftIfActive: finalSecondsLeft,
        isPermanent: parser.isPermanent
      });
      return newMap;
    });
    
    // Set active effect
    updateEffectState({ effectId, isActive: true, isSelected: true });
  });

  useMessageEvent<AvatarEffectExpiredEvent>(AvatarEffectExpiredEvent, event => {
    const parser = event.getParser();
    const expiredEffectType = parser.type;
    
    // Remove the expired effect from availableEffects
    setAvailableEffects(prevMap => {
      const newMap = new Map(prevMap);
      newMap.delete(expiredEffectType);
      return newMap;
    });
    
    // Update EffectsModel to remove expired effect
    const currentEffects = Array.from(availableEffects.keys()).filter(id => id !== expiredEffectType);
    EffectsModel.setAvailableEffects(currentEffects);
    
    // Clear any state related to the expired effect
    if (activeEffectId === expiredEffectType || selectedEffectId === expiredEffectType) {
      updateEffectState({ effectId: 0, clearFigure: true });
    }
    
    // Refresh categories to update UI
    resetCategories();
  });

  const selectCategory = useCallback(
    (name: string) => {
      if (!categories) return;

      setActiveCategory(categories.get(name));
    },
    [categories]
  );

  const resetCategories = useCallback(() => {
    const categories = new Map();

    if (!genderFootballGate) {
      categories.set(AvatarEditorFigureCategory.GENERIC, new BodyModel());
      categories.set(AvatarEditorFigureCategory.HEAD, new HeadModel());
      categories.set(AvatarEditorFigureCategory.TORSO, new TorsoModel());
      categories.set(AvatarEditorFigureCategory.LEGS, new LegModel());
      categories.set(AvatarEditorFigureCategory.EFFECTS, new EffectsModel());
    } else {
      categories.set(AvatarEditorFigureCategory.TORSO, new TorsoModel());
      categories.set(AvatarEditorFigureCategory.LEGS, new LegModel());
    }

    setCategories(categories);
  }, [genderFootballGate]);

  const getEffectTimeDisplay = useCallback(() => {
    // Get the currently selected effect metadata
    const selectedEffectMeta = availableEffects.get(selectedEffectId);
    if (!selectedEffectMeta || selectedEffectId === 0) return "";
    
    if (selectedEffectMeta.isPermanent) {
      return LocalizeText("avatareditor.effects.active.permanent");
    }
    
    const seconds = selectedEffectMeta.secondsLeftIfActive;
    
    const days = Math.floor(seconds / 86400); // 86400 seconds in a day
    
    if (days > 0) {
      return LocalizeText("avatareditor.effects.active.daysleft", ["days_left"], [days.toString()]);
    }
    
    // Format as HH:MM:SS
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    return LocalizeText("avatareditor.effects.active.timeleft", ["time_left"], [timeStr]);
  }, [selectedEffectId, availableEffects]);

  const setupFigures = useCallback(() => {
    const figures: Map<string, FigureData> = new Map();

    const maleFigure = new FigureData();
    const femaleFigure = new FigureData();

    maleFigure.loadAvatarData(DEFAULT_MALE_FIGURE, FigureData.MALE);
    femaleFigure.loadAvatarData(DEFAULT_FEMALE_FIGURE, FigureData.FEMALE);

    figures.set(FigureData.MALE, maleFigure);
    figures.set(FigureData.FEMALE, femaleFigure);

    setFigures(figures);
    setFigureData(figures.get(FigureData.MALE));
  }, []);

  const loadAvatarInEditor = useCallback(
    (figure: string, gender: string, reset: boolean = true) => {
      gender = AvatarEditorUtilities.getGender(gender);

      let newFigureData = figureData;

      if (gender !== newFigureData.gender) newFigureData = figures.get(gender);

      if (figure !== newFigureData.getFigureString()) newFigureData.loadAvatarData(figure, gender);

      if (newFigureData !== figureData) setFigureData(newFigureData);

      if (reset) {
        setLastFigure(figureData.getFigureString());
        setLastGender(figureData.gender);
        setLastEffectId(figureData.avatarEffectType);
      }
    },
    [figures, figureData]
  );

  const processAction = useCallback(
    (action: string) => {
      const isEffectsCategory = activeCategory?.name === AvatarEditorFigureCategory.EFFECTS;

      switch (action) {
        case AvatarEditorAction.ACTION_CLEAR:
          loadAvatarInEditor(figureData.getFigureStringWithFace(0, false), figureData.gender, false);
          updateEffectState({ effectId: 0, clearFigure: true });
          resetCategories();
          return;
        case AvatarEditorAction.ACTION_RESET:
          loadAvatarInEditor(lastFigure, lastGender);
          updateEffectState({ effectId: lastEffectId, isSelected: true });
          resetCategories();
          return;
        case AvatarEditorAction.ACTION_RANDOMIZE:
          const figure = generateRandomFigure(figureData, figureData.gender, GetClubMemberLevel(), figureSetIds, [FigureData.FACE]);

          loadAvatarInEditor(figure, figureData.gender, false);
          resetCategories();
          return;
        case AvatarEditorAction.ACTION_SAVE:
          // Send AvatarEffectSelectedComposer if we have an avatar effect set
          if (figureData.avatarEffectType >= 0 && !genderFootballGate) {
            SendMessageComposer(new AvatarEffectSelectedComposer(figureData.avatarEffectType));
          }

          !genderFootballGate
            ? SendMessageComposer(new UserFigureComposer(figureData.gender, figureData.getFigureString()))
            : SendMessageComposer(new SetClothingChangeDataMessageComposer(objectFootballGate, genderFootballGate, figureData.getFigureString()));
          SetLocalStorage(`nitro.look.footballgate.${genderFootballGate}`, figureData.getFigureString());
          onClose();
          return;
      }
    },
    [loadAvatarInEditor, figureData, resetCategories, lastFigure, lastGender, figureSetIds, genderFootballGate, objectFootballGate, activeCategory]
  );

  const setGender = useCallback(
    (gender: string | ((prevState: string) => string)) => {
      const newGender = typeof gender === "function" ? gender(figureData?.gender || "") : gender;
      const normalizedGender = AvatarEditorUtilities.getGender(newGender);

      setFigureData(figures.get(normalizedGender));
    },
    [figures, figureData]
  );

  useEffect(() => {
    const linkTracker: ILinkEventTracker = {
      linkReceived: (url: string) => {
        const parts = url.split("/");

        setGenderFootballGate(parts[2] ? parts[2] : null);
        setObjectFootballGate(parts[3] ? Number(parts[3]) : null);

        if (parts.length < 2) return;

        switch (parts[1]) {
          case "show":
            setIsVisible(true);
            return;
          case "hide":
            setIsVisible(false);
            return;
          case "toggle":
            setIsVisible(prevValue => !prevValue);
            return;
        }
      },
      eventUrlPrefix: "avatar-editor/",
    };

    AddEventLinkTracker(linkTracker);

    return () => RemoveLinkEventTracker(linkTracker);
  }, []);

  useEffect(() => {
    setSavedFigures(new Array(maxWardrobeSlots));
  }, [maxWardrobeSlots]);

  useEffect(() => {
    SendMessageComposer(new GetWardrobeMessageComposer());
  }, []);

  useEffect(() => {
    if (!categories) return;

    selectCategory(!genderFootballGate ? AvatarEditorFigureCategory.GENERIC : AvatarEditorFigureCategory.TORSO);
  }, [categories, genderFootballGate, selectCategory]);

  useEffect(() => {
    if (!figureData) return;

    AvatarEditorUtilities.CURRENT_FIGURE = figureData;

    // Initialize the selected effect ID
    setSelectedEffectId(figureData.avatarEffectType);
    
    // Set up effect selection callback
    AvatarEditorUtilities.ON_EFFECT_SELECTED = (effectId: number) => {
      updateEffectStateRef.current?.({ effectId, isSelected: true });
    };

    resetCategories();

    return () => {
      AvatarEditorUtilities.CURRENT_FIGURE = null;
      AvatarEditorUtilities.ON_EFFECT_SELECTED = null;
    };
  }, [figureData, resetCategories]);

  useEffect(() => {
    AvatarEditorUtilities.FIGURE_SET_IDS = figureSetIds;
    AvatarEditorUtilities.BOUND_FURNITURE_NAMES = boundFurnitureNames;

    resetCategories();

    return () => {
      AvatarEditorUtilities.FIGURE_SET_IDS = null;
      AvatarEditorUtilities.BOUND_FURNITURE_NAMES = null;
    };
  }, [figureSetIds, boundFurnitureNames, resetCategories]);

  useEffect(() => {
    if (!isVisible) return;

    if (!figures) {
      setupFigures();

      setIsInitalized(true);

      return;
    }
  }, [isVisible, figures, setupFigures]);

  // Countdown timer for active effects - only counts down when effect is active
  useEffect(() => {
    if (activeEffectId === 0) return;

    const activeEffectMeta = availableEffects.get(activeEffectId);
    if (!activeEffectMeta || activeEffectMeta.isPermanent || activeEffectMeta.secondsLeftIfActive <= 0) {
      return;
    }

    const interval = setInterval(() => {
      setAvailableEffects(prevMap => {
        const newMap = new Map(prevMap);
        const effectMeta = newMap.get(activeEffectId);
        
        if (!effectMeta) return prevMap; // Effect no longer exists
        
        const newSecondsLeft = effectMeta.secondsLeftIfActive - 1;
        
        if (newSecondsLeft <= 0) {
          // Effect expired naturally during countdown
          newMap.set(activeEffectId, {
            ...effectMeta,
            secondsLeftIfActive: 0
          });
        } else {
          // Update countdown
          newMap.set(activeEffectId, {
            ...effectMeta,
            secondsLeftIfActive: newSecondsLeft
          });
        }
        
        return newMap;
      });
      
      // Check if effect expired and clear it
      const currentEffectMeta = availableEffects.get(activeEffectId);
      if (currentEffectMeta && currentEffectMeta.secondsLeftIfActive <= 1) {
        updateEffectState({ effectId: 0, clearFigure: true });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeEffectId, updateEffectState]); // Removed availableEffects dependency to prevent unnecessary recreations

  useEffect(() => {
    if (!isVisible || !isInitalized || !needsReset) return;

    if (!genderFootballGate) loadAvatarInEditor(GetSessionDataManager().figure, GetSessionDataManager().gender);
    if (genderFootballGate)
      loadAvatarInEditor(genderFootballGate === FigureData.MALE ? DEFAULT_MALE_FOOTBALL_GATE : DEFAULT_FEMALE_FOOTBALL_GATE, genderFootballGate);
    setNeedsReset(false);
  }, [isVisible, isInitalized, needsReset, loadAvatarInEditor, genderFootballGate, DEFAULT_MALE_FOOTBALL_GATE, DEFAULT_FEMALE_FOOTBALL_GATE]);

  useEffect(() =>
    // This is so when you have the look editor open and you change the mode to Boy or Girl
    {
      if (!isVisible) return;

      return () => {
        setupFigures();
        setIsWardrobeVisible(false);
        setNeedsReset(true);
      };
    }, [isVisible, genderFootballGate, setupFigures]);

  useEffect(() => {
    if (isVisible) return;

    return () => {
      setNeedsReset(true);
    };
  }, [isVisible]);

  if (!isVisible || !figureData) return null;

  const avatarEditorClasses = `nitro-avatar-editor no-resize ${isWardrobeVisible ? "expanded" : ""}`;

  return (
    <NitroCardView uniqueKey="avatar-editor" className={avatarEditorClasses}>
      <NitroCardHeaderView
        headerText={!genderFootballGate ? LocalizeText("avatareditor.title") : LocalizeText("widget.furni.clothingchange.editor.title")}
        onCloseClick={onClose}
      />
      <NitroCardTabsView className="avatar-editor-tabs">
        {categories &&
          categories.size > 0 &&
          Array.from(categories.keys()).map(category => {
            const isActive = activeCategory && activeCategory.name === category;

            return (
              <NitroCardTabsItemView key={category} isActive={isActive} onClick={event => selectCategory(category)}>
                <div className={`tab ${category}`}></div>
              </NitroCardTabsItemView>
            );
          })}
        {!genderFootballGate && (
          <NitroCardTabsItemView onClick={event => setIsWardrobeVisible(!isWardrobeVisible)}>
            <div className="tab-wardrobe"></div>
          </NitroCardTabsItemView>
        )}
      </NitroCardTabsView>
      <NitroCardContentView>
        <Grid>
          <Column size={isWardrobeVisible ? 6 : 8} overflow="hidden">
            {activeCategory && <AvatarEditorModelView model={activeCategory} gender={figureData.gender} setGender={setGender} />}
          </Column>
          <Column size={isWardrobeVisible ? 6 : 4} overflow="hidden">
            <Flex gap={2} className="w-100 h-100">
              <Flex column={true} className="w-100">
                <AvatarEditorFigurePreviewView 
                  figureData={figureData} 
                  activeCategory={activeCategory?.name}
                  onFigureUpdate={() => {
                    setSelectedEffectId(figureData.avatarEffectType);
                  }}
                />
                {activeCategory?.name === AvatarEditorFigureCategory.EFFECTS && selectedEffectId > 0 && (() => {
                  const selectedEffectMeta = availableEffects.get(selectedEffectId);
                  return selectedEffectMeta && (
                    <Column gap={1} className="w-100 px-3 py-2">
                      <Flex center className="w-100">
                        <Text bold>{LocalizeText(`fx_${selectedEffectId}`)}</Text>
                      </Flex>
                      <Flex center className="w-100">
                        <Text fontSize={6}>{getEffectTimeDisplay()}</Text>
                      </Flex>
                      {!selectedEffectMeta.isPermanent && selectedEffectMeta.duration > 0 && (
                        <div className="progress" style={{height: '8px'}}>
                          <div 
                            className="progress-bar bg-success" 
                            role="progressbar" 
                            style={{width: `${(selectedEffectMeta.secondsLeftIfActive / selectedEffectMeta.duration) * 100}%`}}
                            aria-valuenow={selectedEffectMeta.secondsLeftIfActive} 
                            aria-valuemin={0} 
                            aria-valuemax={selectedEffectMeta.duration}
                          />
                        </div>
                      )}
                    </Column>
                  );
                })()}
                <Column grow gap={1}>
                  {!genderFootballGate && (
                    <ButtonGroup className="action-buttons w-100">
                      <Button variant="secondary" onClick={event => processAction(AvatarEditorAction.ACTION_RESET)}>
                        <FaUndo className="fa-icon" />
                      </Button>
                      {activeCategory?.name !== AvatarEditorFigureCategory.EFFECTS && (
                        <>
                          <Button variant="secondary" onClick={event => processAction(AvatarEditorAction.ACTION_CLEAR)}>
                            <FaTrash className="fa-icon" />
                          </Button>
                          <Button variant="secondary" onClick={event => processAction(AvatarEditorAction.ACTION_RANDOMIZE)}>
                            <FaDice className="fa-icon" />
                          </Button>
                        </>
                      )}
                    </ButtonGroup>
                  )}
                  <Button className="w-10" variant="success" onClick={event => processAction(AvatarEditorAction.ACTION_SAVE)}>
                    {LocalizeText("avatareditor.save")}
                  </Button>
                </Column>
              </Flex>
              {isWardrobeVisible && (
                <Column overflow="hidden" className="w-100">
                  <AvatarEditorWardrobeView
                    figureData={figureData}
                    savedFigures={savedFigures}
                    setSavedFigures={setSavedFigures}
                    loadAvatarInEditor={loadAvatarInEditor}
                  />
                </Column>
              )}
            </Flex>
          </Column>
        </Grid>
      </NitroCardContentView>
    </NitroCardView>
  );
};

