import { useCallback, useMemo } from 'react';
import { Draggable } from 'react-beautiful-dnd';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import FaceIcon from '@mui/icons-material/Face';
import HelpIcon from '@mui/icons-material/Help';
import LinkIcon from '@mui/icons-material/Link';
import SettingsIcon from '@mui/icons-material/Settings';
import UpdateIcon from '@mui/icons-material/Update';
import WarningIcon from '@mui/icons-material/Warning';
import {
  Box,
  Checkbox,
  Chip,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';
import type { Mod } from 'bridge/BridgeAPI';
import { IShellAPI } from 'bridge/ShellAPI';
import { consumeAPI } from './IPC';
import { useSelectedMod, useToggleMod } from './ModsContext';

const ShellAPI = consumeAPI<IShellAPI>('ShellAPI');

function ListChip({
  color,
  icon,
  label,
  onClick,
  tooltip,
}: {
  color?: React.ComponentProps<typeof Chip>['color'];
  icon: React.ComponentProps<typeof Chip>['icon'];
  label: React.ComponentProps<typeof Chip>['label'];
  onClick?: React.ComponentProps<typeof Chip>['onClick'];
  tooltip?: string;
}): JSX.Element {
  const onClickWithoutPropagation = useMemo(() => {
    if (onClick == null) {
      return undefined;
    }
    return (event: React.MouseEvent<HTMLDivElement, MouseEvent>): void => {
      event.stopPropagation();
      onClick(event);
    };
  }, [onClick]);

  const onMouseDownWithoutPropagation = useMemo(() => {
    if (onClick == null || tooltip != null) {
      return undefined;
    }
    return (event: React.MouseEvent<HTMLDivElement, MouseEvent>): void => {
      event.stopPropagation();
    };
  }, [onClick, tooltip]);

  const chip = (
    <Chip
      clickable={onClick != null}
      color={color}
      icon={icon}
      label={label}
      onClick={onClickWithoutPropagation}
      onMouseDown={onMouseDownWithoutPropagation}
      size="small"
      sx={{ ml: 1, cursor: 'pointer' }}
    />
  );

  if (tooltip != null) {
    return <Tooltip title={tooltip}>{chip}</Tooltip>;
  }

  return chip;
}

type Props = {
  index: number;
  isEnabled: boolean;
  isReorderEnabled: boolean;
  mod: Mod;
};

export default function ModListItem({
  index,
  isEnabled,
  isReorderEnabled,
  mod,
}: Props) {
  const onToggleMod = useToggleMod();
  const [, setSelectedMod] = useSelectedMod();

  const onConfigureMod = useCallback((): void => {
    setSelectedMod(mod);
  }, [mod, setSelectedMod]);

  const onOpenWebsite = useCallback((): void => {
    if (mod.info.website != null) {
      ShellAPI.openExternal(mod.info.website).catch(console.error);
    }
  }, [mod]);

  const labelId = `mod-label-${mod}`;

  const item = (
    <ListItem key={mod.id} disablePadding={true}>
      <ListItemButton
        onClick={() => onToggleMod(mod)}
        sx={{ width: 'auto', flexGrow: 1, flexShrink: 1 }}
      >
        <ListItemIcon>
          <Checkbox
            checked={isEnabled}
            disableRipple={true}
            edge="start"
            inputProps={{
              'aria-labelledby': labelId,
            }}
            tabIndex={-1}
          />
        </ListItemIcon>
        <ListItemText
          id={labelId}
          primary={
            <Box sx={{ display: 'flex', flexDirection: 'row' }}>
              <Typography>{mod.info.name}</Typography>
              {mod.info.description == null ? null : (
                <Tooltip title={mod.info.description}>
                  <HelpIcon color="disabled" sx={{ ml: 1 }} />
                </Tooltip>
              )}
              <Box sx={{ flex: 1 }} />
              {mod.info.website == null ? null : (
                <ListChip
                  icon={<LinkIcon />}
                  label="site"
                  onClick={onOpenWebsite}
                />
              )}
              {mod.info.type !== 'data' ? null : (
                <ListChip
                  color="warning"
                  icon={<WarningIcon />}
                  label="Data Mod"
                  tooltip="This mod is a non-D2RMM data mod and may conflict with other mods or game updates."
                />
              )}
              {mod.info.author == null ? null : (
                <ListChip icon={<FaceIcon />} label={mod.info.author} />
              )}
              {mod.info.version == null ? null : (
                <ListChip
                  icon={<UpdateIcon />}
                  label={`v${mod.info.version}`}
                />
              )}
              {mod.info.config == null ? null : (
                <ListChip
                  color={isEnabled ? 'primary' : undefined}
                  icon={<SettingsIcon />}
                  label="settings"
                  onClick={onConfigureMod}
                />
              )}
            </Box>
          }
        />
      </ListItemButton>
      {isReorderEnabled ? <DragIndicatorIcon color="disabled" /> : null}
    </ListItem>
  );

  if (isReorderEnabled) {
    return (
      <Draggable draggableId={mod.id} index={index}>
        {(providedDraggable) => (
          <div
            ref={providedDraggable.innerRef}
            {...providedDraggable.draggableProps}
            {...providedDraggable.dragHandleProps}
          >
            {item}
          </div>
        )}
      </Draggable>
    );
  }

  return item;
}
