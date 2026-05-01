import { Circle, Square, Database, TriangleAlert } from 'lucide-react';
import { useSimulationStore } from '../store';
import { useShallow } from 'zustand/shallow';
import { ScrollArea } from './ui/scroll-area';
import type { Entity } from '../ecs/types';
import type { ColliderComponent, MaterialComponent } from '../ecs/types';

const SHAPE_ICONS: Record<string, typeof Circle> = {
  sphere: Circle,
  cuboid: Square,
  cylinder: Database,
};

function getShapeFromEntity(entity: Entity): string {
  const collider = entity.components.get('collider') as ColliderComponent | undefined;
  return collider?.shape ?? 'sphere';
}

function getColorFromEntity(entity: Entity): string {
  const material = entity.components.get('material') as MaterialComponent | undefined;
  return material?.color ?? '#888888';
}

function getShapeIcon(shape: string) {
  return SHAPE_ICONS[shape] || Circle;
}

export default function EntityList() {
  const entityList = useSimulationStore(
    useShallow((s) =>
      Array.from(s.entities.values()).map((e) => ({
        id: e.id,
        name: e.name,
        shape: getShapeFromEntity(e),
        color: getColorFromEntity(e),
      })),
    ),
  );
  const selectedId = useSimulationStore((s) => s.selectedEntityId);
  const selectEntity = useSimulationStore((s) => s.selectEntity);

  if (entityList.length === 0) {
    return (
      <div className="px-3 py-4 text-sm text-center" style={{ color: '#555' }}>
        暂无实体
      </div>
    );
  }

  return (
    <ScrollArea className="h-[120px]" style={{ maxHeight: '120px' }}>
      <div role="list" className="flex flex-col">
        {entityList.map(({ id, name, shape, color }) => {
          const isSelected = id === selectedId;
          const Icon = getShapeIcon(shape);
          return (
            <button
              key={id}
              type="button"
              role="listitem"
              aria-selected={isSelected}
              onClick={() => selectEntity(id)}
              className="flex items-center gap-2 px-3 h-10 text-sm w-full text-left
                transition-colors duration-100 border-l-[3px] border-l-transparent"
              style={{
                ...(isSelected
                  ? {
                      borderLeftColor: '#3b82f6',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      color: '#ffffff',
                    }
                  : {
                      color: '#e0e0e0',
                    }),
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Icon size={14} strokeWidth={2} style={{ color: '#a0a0a0', flexShrink: 0 }} />
              <span className="truncate flex-1">{name}</span>
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
