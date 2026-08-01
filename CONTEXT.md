# Physics Simulation Platform

基于 Rapier + React Three Fiber 的模块化物理模拟平台，支持自定义组件组合与多物理场耦合场景的实时可视化。

## Language

### 视觉与布局

**Sci-fi Lab（科幻实验室风）**:
本项目的 canonical 视觉方向：深空配色、发光/辉光元素、玻璃拟态面板、全息质感 3D 材质。
_Avoid_: 科技感、赛博朋克、 futuristic UI

**Docked Panels（停靠面板）**:
工作区布局范式：面板可拖拽分栏、合并、重排（Blender 式），取代旧的 fixed/absolute 浮动面板。
_Avoid_: 固定布局、浮动面板（旧范式，见 ADR-0001）

### 模拟核心

**Entity（实体）**:
模拟场景中的一个物理对象，由 ECS 组件组合描述（transform、rigidBody、forceField 等）。
_Avoid_: object、body（body 特指 Rapier RigidBody）

**Force Field（力场）**:
对实体施加持续作用力的场组件，多场矢量叠加后注入物理步。
_Avoid_: force source、field effect

**Field Source（场源）**:
实体自身作为场的来源（Phase 8 场-源关系）：charge≠0 的实体自动成为库仑场源（同号相斥、异号相吸）；带 currentSource 组件的实体等效为无限长直导线，产生环形磁场（毕奥-萨伐尔简化）。与预设 Force Field（外加场）互补：力场是外部施加的，场源是实体自带的。
_Avoid_: field emitter、source field

**Face Friction（面摩擦）**:
碰撞体的每个面（cuboid 6 面 / cylinder 3 面 / sphere 整面 / 凸形顶底+N侧）独立配置摩擦系数与「固定」标记（collider.faces）。接触摩擦 = 两个接触面系数相乘（Rapier Multiply 规则）；固定面摩擦视为 ∞，接触点不发生相对滑动。无 faces 配置的实体回退 rigidBody.friction 单面模式。
_Avoid_: surface friction、per-face material

**Fixed Joint（固定连接）**:
两个实体间的刚性约束（kind='fixed' 的 constraint 实体），锁定相对位姿（Rapier fixed joint），用于轨道组合等装配场景。锚点与相对坐标架在创建时按当前位姿计算（jointCalc），不产生吸附位移。与弹簧（kind='spring'，弹性约束）区分。
_Avoid_: weld、glue、rigid link

**Revolve（车削）**:
自定义凸形的第二种成型方式（collider.params.mode='revolve'）：2D 轮廓（x ≥ 0，凸）绕局部 Y 轴旋转 24 段生成回转体。视觉与碰撞同源于旋转点集的凸包。回转体面模型为整面（同球体）。
_Avoid_: lathe、spin

**Track（轨道）**:
默认 fixed 不动的场景构件（物理题中的轨道）：平面薄板、斜面（倾角可调）、圆弧面（环形扇区，楔块分解凸碰撞体，arcGeometry）、双弧圆轨道（见下）。通过 TrackBuilder 创建，面摩擦可编辑，「可滑动」开关可转为 dynamic。圆弧/双弧轨道支持属性面板整体旋转（transform.rotation 欧拉角，形状不变仅空间朝向改变；已拼接的接缝检测盒不随旋转更新，先旋转再拼接）。
_Avoid_: ramp（泛指，用具体类型名）

**Double-Arc Ring Track（双弧圆轨道）**:
同圆心内外两道环壁在竖直平面内形成的环形通道轨道（collider.shape='doubleArc'，doubleArcGeometry）：内环壁（innerWall）+ 外环壁（outerWall）+ 主体（body）三面模型，4×segments 凸楔块分解（默认 48 段，同相位）。参数 innerR（内环壁接触面半径）/ channelGap（通道宽度 = 内径）/ thickness（壁厚）/ arcAngle（弧角，360=整环）/ width。通道宽度即「内径」——直径等于它的球应顺畅通过（见 Channel Clearance）。外环壁内接触面用外接弦（顶点半径 R/cos δ）防止通道变窄夹球。
_Avoid_: ring track、pipe track、circular tube

**Channel Clearance（内径游隙）**:
双弧圆轨道的防卡顿设计（channelClearance）：直径恰等于内径的球若零间隙夹在两壁之间，接触求解产生预紧力、摩擦放大数倍把球锁死。外环壁接触面（与视觉同步）外移 ε = max(5mm, 2%×channelGap)，保证紧配球始终有真实游隙；内径语义 = 可通过的最大球直径。
_Avoid_: tolerance、gap offset

**Ghost Placement（虚影放置）**:
ObjectBuilder「虚影放置」按钮触发的放置模式（uiSlice.placement + PlacementGhost + placementCalc）：关闭对话框后半透明虚影跟随鼠标，吸附到已创建物体表面（raycast 过滤 userData.entityId，无命中兜底地面 y=0）；物体中心 = 命中点 + 法线 × 支撑距离（AABB 角点最大投影）+ 滚轮高度（0.1m 步进）；左键落位，Esc 取消并还原建造器状态。放置期间 OrbitControls 禁用。
_Avoid_: drag placement、preview spawn

**Splice（轨道拼接）**:
constraint kind='splice' 的约束实体：新轨道按拼接面自动对齐到母版轨道（法线反向共线 + 面心重合，spliceCalc），并在接缝处生成检测盒——物体通过时按配置损耗速度（数值或百分比）。
_Avoid_: track link、track joint

**Rope / Rod（轻绳 / 轻杆）**:
连接体的两种类型（constraint kind='rope' / 连杆实体+双球窝）：轻绳为只受拉的最大距离约束（rope joint，松弛有效）；轻杆为拉压双向的无质量刚性连杆（质量 0.01 的细圆柱 + 两端球窝）。
_Avoid_: string、cable（用「轻绳」）、pole（用「轻杆」）

**Revolute / Spherical Joint（铰链 / 球窝关节）**:
连接功能的另外两种类型（二期）：铰链绕共享轴相对旋转（Rapier revolute，轴为共享局部空间表达，非对齐刚体为近似）；球窝锚点重合、全向旋转（spherical）。与固定连接共用创建流程、连接线渲染与关节分发渲染器（FixedJointRenderer）。
_Avoid_: hinge（用「铰链」）、ball joint（用「球窝」）
