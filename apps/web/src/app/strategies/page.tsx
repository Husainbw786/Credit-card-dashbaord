import { setStrategyEnabled } from '@/lib/actions';
import { getKnowledgeBase } from '@/lib/kb';
import { Badge, Button, Card, H1, Muted } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function StrategiesPage() {
  const { kb } = await getKnowledgeBase();
  return (
    <div>
      <H1>Strategies</H1>
      <Muted className="mt-1">The payment patterns the engine tries. Turn one off to hide its routes.</Muted>
      <div className="mt-4 space-y-3">
        {kb.strategies.map((s) => (
          <Card key={s.id} className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{s.name}</h3>
                <Badge tone={s.enabled ? 'high' : 'info'}>{s.enabled ? 'on' : 'off'}</Badge>
              </div>
              {s.description && <Muted className="mt-1">{s.description}</Muted>}
            </div>
            <form action={setStrategyEnabled}>
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="enabled" value={s.enabled ? 'false' : 'true'} />
              <Button variant="secondary" type="submit">
                {s.enabled ? 'Turn off' : 'Turn on'}
              </Button>
            </form>
          </Card>
        ))}
      </div>
      <Card className="mt-6">
        <h3 className="font-medium">Your next variations</h3>
        <Muted className="mt-1">
          Describe variation 2 and 3 to the developer in the same form as the Giva one (&quot;suppose I want to buy X, I would…&quot;). Each becomes a new strategy here, with its own routes in the shop assistant.
        </Muted>
      </Card>
    </div>
  );
}
