interface PromiseResolver {
  resolve: (entity: Entity) => void;
  reject: (error: Error) => void;
}

type RequestsItems = Map<string, PromiseResolver[]>;
type RequestCompendiums = Map<string, RequestsItems>;

export class CompendiumUtils {

  private static requests: RequestCompendiums = new Map<string, RequestsItems>();
  private static buffer: NodeJS.Timeout;

  public static request(compendiumId: string, entityId: string): Promise<Entity> {
    const resolver: PromiseResolver = {
      resolve: null,
      reject: null
    }
    const promise: Promise<Entity> = new Promise<Entity>((resolve, reject) => {
      resolver.resolve = resolve
      resolver.reject = reject
    });

    if (!this.requests.has(compendiumId)) {
      this.requests.set(compendiumId, new Map<string, PromiseResolver[]>());
    }

    if (!this.requests.get(compendiumId).get(entityId)) {
      this.requests.get(compendiumId).set(entityId, []);
    }
    this.requests.get(compendiumId).get(entityId).push(resolver);

    if (!this.buffer) {
      this.buffer = setTimeout(() => {
        this.buffer = null;
        this.execute();
      }, 0);
    }

    return promise;
  }

  private static execute(): void {
    const requests = this.requests;
    console.log(requests);
    this.requests = new Map<string, RequestsItems>();

    requests.forEach((items, compendiumId) => {
      const compendium: Compendium = game.packs.get(compendiumId);
      compendium.getContent().then(entities => {
        const entityMap = new Map<string, Entity>();
        for (const entity of entities) {
          entityMap.set(entity.id, entity);
        }

        items.forEach((promises, entityId) => {
          promises.forEach(promise => promise.resolve(entityMap.get(entityId)));
        });
      });
    });
  }

}