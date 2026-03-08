import * as parser from "txml";

function getOutlineLabel(attributes: Record<string, string | undefined>) {
  return (attributes.title || attributes.text || "").trim();
}

const opmlParser = {
  load(opmlString: string) {
    const xlmContent = parser.parse(opmlString);

    const startNode = (xlmContent[1] as any).children[1].children;

    // @ts-ignore
    const categories = startNode.map((node) => {
      const categoryTitle = getOutlineLabel(node.attributes);

      return {
        title: categoryTitle,
        text: node.attributes.text || categoryTitle,
      };
    });

    const feeds: Feed[] = [];

    // @ts-ignore
    startNode.forEach((node) => {
      const categoryTitle = getOutlineLabel(node.attributes);

      // @ts-ignore
      node.children.forEach((feedEl) => {
        feeds.push({
          categoryTitle,
          title: getOutlineLabel(feedEl.attributes),
          url: feedEl.attributes.htmlUrl,
          feedUrl: feedEl.attributes.xmlUrl,
          feedType: feedEl.attributes.type,
        });
      });
    });

    return {
      categories,
      feeds,
    };
  },
};
export default opmlParser;
