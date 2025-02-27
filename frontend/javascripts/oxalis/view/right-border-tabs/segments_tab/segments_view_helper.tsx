import { Modal } from "antd";
import type { APIDataLayer } from "types/api_flow_types";
import type { ActiveMappingInfo, Segment } from "oxalis/store";
import Store from "oxalis/store";
import { MappingStatusEnum } from "oxalis/constants";
import { setMappingAction, setMappingEnabledAction } from "oxalis/model/actions/settings_actions";
import { waitForCondition } from "libs/utils";
import { getMappingInfo } from "oxalis/model/accessors/dataset_accessor";
import { getEditableMappingForVolumeTracingId } from "oxalis/model/accessors/volumetracing_accessor";
import type { MenuClickEventHandler } from "rc-menu/lib/interface";

const { confirm } = Modal;

export type SegmentHierarchyGroup = {
  title: string;
  type: "group";
  name: string | null | undefined;
  id: number;
  key: string;
  children: Array<SegmentHierarchyNode>;
};

export type SegmentHierarchyLeaf = Segment & {
  type: "segment";
  key: string;
  title: string;
};

export type SegmentHierarchyNode = SegmentHierarchyLeaf | SegmentHierarchyGroup;

export function getBaseSegmentationName(segmentationLayer: APIDataLayer) {
  return (
    ("fallbackLayer" in segmentationLayer ? segmentationLayer.fallbackLayer : null) ||
    segmentationLayer.name
  );
}

export function withMappingActivationConfirmation(
  originalOnClick: MenuClickEventHandler,
  mappingName: string | null | undefined,
  descriptor: string,
  layerName: string | null | undefined,
  mappingInfo: ActiveMappingInfo,
) {
  const editableMapping = getEditableMappingForVolumeTracingId(Store.getState(), layerName);

  const isMappingEnabled = mappingInfo.mappingStatus === MappingStatusEnum.ENABLED;
  const enabledMappingName = isMappingEnabled ? mappingInfo.mappingName : null;

  // If the mapping name is undefined, no mapping is specified. In that case never show the activation modal.
  // In contrast, if the mapping name is null, this indicates that all mappings should be specifically disabled.
  if (mappingName === undefined || layerName == null || mappingName === enabledMappingName) {
    return originalOnClick;
  }

  const actionStr = editableMapping == null ? "will" : "cannot";
  const mappingString =
    mappingName != null
      ? `for the mapping "${mappingName}" which is not active. The mapping ${actionStr} be activated`
      : `without a mapping but a mapping is active. The mapping ${actionStr} be deactivated`;
  const recommendationStr =
    editableMapping == null
      ? ""
      : "This is because the current mapping was locked while editing it with the proofreading tool. Consider changing the active mapping instead.";

  const confirmMappingActivation: MenuClickEventHandler = (menuClickEvent) => {
    confirm({
      title: `The currently active ${descriptor} was computed ${mappingString} when clicking OK. ${recommendationStr}`,
      async onOk() {
        if (editableMapping != null) {
          return;
        }
        if (mappingName != null) {
          Store.dispatch(setMappingAction(layerName, mappingName, "HDF5"));
          await waitForCondition(
            () =>
              getMappingInfo(
                Store.getState().temporaryConfiguration.activeMappingByLayer,
                layerName,
              ).mappingStatus === MappingStatusEnum.ENABLED,
            100,
          );
        } else {
          Store.dispatch(setMappingEnabledAction(layerName, false));
          await waitForCondition(
            () =>
              getMappingInfo(
                Store.getState().temporaryConfiguration.activeMappingByLayer,
                layerName,
              ).mappingStatus === MappingStatusEnum.DISABLED,
            100,
          );
        }

        originalOnClick(menuClickEvent);
      },
    });
  };

  return confirmMappingActivation;
}
