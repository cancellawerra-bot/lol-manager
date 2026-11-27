import { PATCH_NOTES } from "./patchdata";
import { Card } from "../ui";
export default function Patch() {
  return (
    <Card title="패치 노트">
      {PATCH_NOTES.map((p) => (
        <div key={p.v} className="patch"><h3>v{p.v} <small className="muted">{p.date}</small></h3><ul>{p.items.map((x) => <li key={x}>{x}</li>)}</ul></div>
      ))}
      <h3>다음 버전 계획</h3>
      <ul className="muted"><li>LCK컵, Road to MSI, Rounds 3-4, 월즈 일정</li><li>이적시장·재계약·스카우팅(추정 범위)</li><li>수업 시나리오 지정·교실 리그(수업 보고서는 v2.45.0)</li><li>2D 미니맵 관전, 다시즌</li></ul>
    </Card>
  );
}
