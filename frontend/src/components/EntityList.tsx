import { useMemo } from 'react';
import { Circle, Square, Database, Link2 } from 'lucide-react';
import { useSimulationStore } from '../store';
import { ScrollArea } from './ui/scroll-area';
import type { Entity } from '../ecs/types';
import type { ColliderComponent, MaterialComponent } from '../ecs/types';

const SHAPE_ICONS: Record<string, typeof Circle> = {
  sphere: Circle,
  cuboid: Square,
  cylinder: Database,
};

function isSpringEntity(entity: Entity): boolean {
  return entity.components.has('constraint');
}

function getShapeFromEntity(entity: Entity): string {
  if (isSpringEntity(entity)) return 'spring';
  const collider = entity.components.get('collider') as ColliderComponent | undefined;
  return collider?.shape ?? 'sphere';
}

function getColorFromEntity(entity: Entity): string {
  if (isSpringEntity(entity)) return 'var(--muted-foreground)';
  const material = entity.components.get('material') as MaterialComponent | undefined;
  return material?.color ?? 'var(--muted-foreground)';
}

function getShapeIcon(shape: string) {
  if (shape === 'spring') return Link2;
  return SHAPE_ICONS[shape] || Circle;
}

export default function EntityList() {
  const entities = useSimulationStore((s) => s.entities);

  const entityList = useMemo(
    () =>
      Array.from(entities.values()).map((e) => ({
        id: e.id,
        name: e.name,
        shape: getShapeFromEntity(e),
        color: getColorFromEntity(e),
      })),
    [entities],
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
                      borderLeftColor: 'var(--holo)',
                      backgroundColor: 'var(--holo-a10)',
                      color: 'var(--foreground)',
                    }
                  : {
                      color: 'var(--foreground)',
                    }),
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Icon size={14} strokeWidth={2} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
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
