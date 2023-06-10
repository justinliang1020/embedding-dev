import { Configuration, OpenAIApi } from "openai";
import { NextResponse } from "next/server";
import { PDFLoader } from "langchain/document_loaders/fs/pdf"
import { TextLoader } from "langchain/document_loaders/fs/text"
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { ChromaClient, CohereEmbeddingFunction, IEmbeddingFunction, OpenAIEmbeddingFunction } from "chromadb";
import { CollectionMetadata } from "@/utils/utils";
import { v4 as uuid } from "uuid";
import { PalmEmbeddingFunction } from "@/utils/palm";
export async function POST(req: Request) {
    if (process.env.OPENAI_API_KEY === undefined) {
        throw Error("no openai api key")
    }
    if (process.env.COHERE_API_KEY === undefined) {
        throw Error("no cohere api key");
    }
    if (process.env.PALM_API_KEY === undefined) {
        throw Error("no palm api key");
    }

    const client = new ChromaClient({
        path: `http://${process.env.CHROMA_SERVER_HOST}:${process.env.CHROMA_SERVER_HTTP_PORT}`
    });
    const data = await req.formData();
    // condition, if no file don't use any upload
    const file = data.get("file") as File;
    let content = "";
    if (file === null) {
        console.log("no file");
        content = sampleContent;
    } else {
        switch (file.type) {
            case "application/pdf":
                const pdfLoader = new PDFLoader(file, {
                    splitPages: false
                });
                const pdfDocs = await pdfLoader.load();
                content = pdfDocs[0].pageContent;
                break;
            case "text/plain":
                const textLoader = new TextLoader(file);
                const textDocs = await textLoader.load();
                content = textDocs[0].pageContent;
                break;
            default:
                console.log('invalid pdf type')
                break;
        }
    }
    const collectionMetadata = JSON.parse(data.get("collectionMetadata") as string) as CollectionMetadata;


    console.log(collectionMetadata)
    let embeddingFunction: IEmbeddingFunction;
    switch (collectionMetadata.embeddingModel) {
        case ("text-embedding-ada-002"):
            embeddingFunction = new OpenAIEmbeddingFunction({
                openai_api_key: process.env.OPENAI_API_KEY
            });
            break;
        case ("embed-english-v2.0"):
            embeddingFunction = new CohereEmbeddingFunction({
                cohere_api_key: process.env.COHERE_API_KEY
            });
            break;
        case ("embedding-gecko-001"):
            embeddingFunction = new PalmEmbeddingFunction(
                process.env.PALM_API_KEY,
            );
            break;
    }
    const collectionId = uuid();
    const collection = await client.createCollection({
        name: collectionId,
        metadata: collectionMetadata,
        embeddingFunction: embeddingFunction,
    });

    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: collectionMetadata.chunkSize,
        chunkOverlap: collectionMetadata.chunkSize / 15, //MAGIC NUMBER
        separators: ["\n\n", "\n", " "]
    });
    // TODO: fix chunk summarization, it broken, too slow on large collections
    const texts = await textSplitter.splitText(content);
    switch (collectionMetadata.retrievalMethod) {
        case "chunk-summarization":
            const summaries: string[] = [];
            const openai = new OpenAIApi(new Configuration({
                apiKey: process.env.OPENAI_API_KEY,
            }));
            for (const text of texts) {
                const prompt = `Summarize the following text:
                ${text}
                `
                const completion = await openai.createChatCompletion({
                    model: "gpt-3.5-turbo",
                    messages: [
                        { role: "user", content: prompt }
                    ]
                });
                const content = completion.data.choices[0].message?.content;
                if (content === undefined) {
                    throw ("error, openai api died")
                }
                summaries.push(content)
            }
            const embeddings = await embeddingFunction.generate(summaries);
            await collection.add({
                ids: Array.from({ length: texts.length }, () => uuid()),
                documents: texts,
                embeddings: embeddings,
            })
            break;
        default:
            await collection.add({
                ids: Array.from({ length: texts.length }, () => uuid()),
                documents: texts,
            })
            break;
    }
    // console.log("texts length", texts.length)
    // const results = await collection.query({
    //     queryTexts: "gaming",
    //     nResults: 1,
    // });
    console.log("Created collection with collectionId:", collectionId)
    // console.log('results', results);
    // split content and add to metadata
    return NextResponse.json({ "collectionId": collectionId })
}

const sampleContent = `
The United States of America (U.S.A. or USA), commonly known as the United States (U.S. or US) or America, is a country primarily located in North America. It consists of 50 states, a federal district, five major unincorporated territories, nine Minor Outlying Islands,[i] and 326 Indian reservations. The United States is the world's third-largest country by both land and total area.[c] It shares land borders with Canada to its north and with Mexico to its south and has maritime borders with the Bahamas, Cuba, Russia, and other nations.[j] With a population of over 333 million,[k] it is the most populous country in the Americas and the third most populous in the world. The national capital of the United States is Washington, D.C., and its most populous city and principal financial center is New York City.

Indigenous peoples have inhabited the Americas for thousands of years. Beginning in 1607, British colonization led to the establishment of the Thirteen Colonies in what is now the Eastern United States. They quarreled with the British Crown over taxation and political representation, leading to the American Revolution and proceeding Revolutionary War. The United States declared independence on July 4, 1776, becoming the first nation-state founded on Enlightenment principles of unalienable natural rights, consent of the governed, and liberal democracy. During the nineteenth century, the United States political philosophy was influenced by the concept of manifest destiny, as the country expanded across the continent in a number of wars, land purchases, and treaties, eventually reaching the Pacific Ocean by the middle of the century. Sectional division surrounding slavery in the Southern United States led to the secession of the Confederate States of America, which fought the remaining states of the Union during the American Civil War (1861–1865). With the Union's victory and preservation, slavery was abolished nationally by the Thirteenth Amendment.

By 1900, the United States had established itself as a world power, becoming the world's largest economy. After Japan's attack on Pearl Harbor in 1941, the U.S. entered World War II on the Allied side. The aftermath of the war left the United States and the Soviet Union as the world's two superpowers and led to the Cold War. During the Cold War, both countries engaged in a struggle for ideological dominance but avoided direct military conflict. They also competed in the Space Race, which culminated in the 1969 landing of Apollo 11, making the U.S. the first and only nation to ever land humans on the Moon. With the Soviet Union's collapse and the subsequent end of the Cold War in 1991, the United States emerged as the world's sole superpower.

The United States government is a federal republic and a representative democracy with three separate branches of government. It has a bicameral national legislature composed of the House of Representatives, a lower house; and the Senate, an upper house based on equal representation for each state. Many policy issues are decentralized, with widely differing laws by jurisdiction. The U.S. ranks highly in international measures of quality of life, income and wealth, economic competitiveness, human rights, innovation, and education; it has low levels of perceived corruption and the highest median income per person of any polity in the world. It has high levels of incarceration and inequality and lacks universal health care. As a melting pot of cultures and ethnicities, the U.S. has been shaped by the world's largest immigrant population.

A developed country, the American economy accounts for approximately a quarter of global GDP and is the world's largest by GDP at market exchange rates. The United States is the world's largest importer and second-largest exporter. The United States is a founding member of the United Nations, World Bank, International Monetary Fund, Organization of American States, NATO, World Health Organization, and is a permanent member of the United Nations Security Council. The U.S. is the foremost military power in the world and a dominant political, cultural, and scientific force internationally.

Etymology
Further information: Names of the United States and Names for United States citizens
The first documentary evidence of the phrase "United States of America" dates back to a letter from January 2, 1776, written by Stephen Moylan to Joseph Reed, George Washington's aide-de-camp. Moylan expressed his wish to go "with full and ample powers from the United States of America to Spain" to seek assistance in the revolutionary war effort.[27][28][29] The first known publication of the phrase "United States of America" was in an anonymous essay in The Virginia Gazette newspaper in Williamsburg, on April 6, 1776.[30]

By June 1776, the name "United States of America" had appeared in drafts of the Articles of Confederation and Perpetual Union, prepared by John Dickinson[31][32] and of the Declaration of Independence, written by Thomas Jefferson.[31]

The phrase "United States" was originally plural in American usage. It described a collection of states—e.g., "the United States are..." The singular form became popular after the end of the Civil War and is now standard usage. A citizen of the United States is called an "American". "United States", "American", and "U.S." refer to the country adjectivally ("American values", "U.S. forces"). In English, the word "American" rarely refers to topics or subjects not directly connected with the United States.[33][failed verification]

History
Main article: History of the United States
For a topical guide, see Outline of United States history.
Pre-Columbian period (before 1492)
Further information: Native Americans in the United States and Pre-Columbian era
Aerial view of the Cliff Palace
Cliff Palace, located in present-day Colorado, was built by the Ancestral Puebloans between AD 1190 and 1260.
It is generally accepted that the first inhabitants of North America migrated from Siberia by way of the Bering land bridge and arrived at least 12,000 years ago; however, some evidence suggests an even earlier date of arrival.[34][35][36] The Clovis culture, which appeared around 11,000 BC, is believed to represent the first wave of human settlement of the Americas.[37][38] This was likely the first of three major waves of migration into North America; later waves brought the ancestors of present-day Athabaskans, Aleuts, and Eskimos.[39]

Over time, indigenous cultures in North America grew increasingly sophisticated, and some, such as the pre-Columbian Mississippian culture in the southeast, developed advanced agriculture, architecture, and complex societies.[40] The city-state of Cahokia is the largest, most complex pre-Columbian archaeological site in the modern-day United States.[41] In the Four Corners region, Ancestral Puebloan culture developed from centuries of agricultural experimentation.[42] The Algonquian are one of the most populous and widespread North American indigenous peoples. This grouping consists of the peoples who speak Algonquian languages.[43] Historically, these peoples were prominent along the Atlantic Coast and into the interior along the Saint Lawrence River and around the Great Lakes. Before Europeans came into contact, most Algonquian settlements lived by hunting and fishing, although many supplemented their diet by cultivating corn, beans and squash (the "Three Sisters"). The Ojibwe cultivated wild rice.[44] The Haudenosaunee confederation of the Iroquois, located in the southern Great Lakes region, was established at some point between the twelfth and fifteenth centuries.[45]

Estimating the native population of North America during European contact is difficult.[46][47] Douglas H. Ubelaker of the Smithsonian Institution estimated a population of 93,000 in the South Atlantic states and a population of 473,000 in the Gulf states,[48] but most academics regard this figure as too low.[46] Anthropologist Henry F. Dobyns believed the populations were much higher, suggesting around 1.1 million along the shores of the Gulf of Mexico, 2.2 million people living between Florida and Massachusetts, 5.2 million in the Mississippi Valley and tributaries, and around 700,000 people in the Florida peninsula.[46][47]

Colonial period (1492–1763)
Further information: Colonial history of the United States, European colonization of the Americas, and Slavery in the colonial history of the United States

The Mayflower Compact signed on the Mayflower in 1620 set an early precedent for self-government and constitutionalism.
Claims of very early colonization of coastal New England by the Norse are disputed and controversial.[49][50][failed verification] Christopher Columbus had landed in Puerto Rico on his 1493 voyage, and San Juan was settled by the Spanish a decade later.[51] The first documented arrival of Europeans in the continental United States is that of Spanish conquistadors such as Juan Ponce de León, who made his first expedition to Florida in 1513.[citation needed] The Italian explorer Giovanni da Verrazzano, sent by France to the New World in 1525, encountered Native American inhabitants of what is now called New York Bay.[52] The Spanish set up the first settlements in Florida and New Mexico, such as Saint Augustine, often considered the nation's oldest city,[53] and Santa Fe. The French established their own settlements along the Mississippi River and Gulf of Mexico, notably New Orleans and Mobile.[54]

Successful English colonization of the eastern coast of North America began with the Virginia Colony in 1607 at Jamestown and with the Pilgrims' colony at Plymouth in 1620.[55][56] The continent's first elected legislative assembly, Virginia's House of Burgesses, was founded in 1619. Harvard College was established in the Massachusetts Bay Colony in 1636 as the first institution of higher education. The Mayflower Compact and the Fundamental Orders of Connecticut established precedents for representative self-government and constitutionalism that would develop throughout the American colonies.[57][58] Many English settlers were dissenting Christians who came seeking religious freedom. The native population of America declined after European arrival for various reasons,[59][60][61] primarily from diseases such as smallpox and measles.[62][63] By the mid-1670s, the British had defeated and seized the territory of Dutch settlers in New Netherland, in the mid-Atlantic region.

Map of the U.S. showing the original Thirteen Colonies along the eastern seaboard
The United Colonies in 1775: * Dark Red = New England colonies. * Bright Red = Middle Atlantic colonies. * Red-brown = Southern colonies
In the early days of colonization, many European settlers experienced food shortages, disease, and conflicts with Native Americans, such as in King Philip's War. Native Americans were also often fighting neighboring tribes and European settlers. In many cases the natives and settlers came to depend on each other. Settlers traded for food and animal pelts; natives for guns, tools and other European goods.[64] American Indians taught many settlers to cultivate corn, beans, and other foodstuffs. European missionaries and others felt it was important to "civilize" the Native Americans and urged them to adopt European agricultural practices and lifestyles.[65][66] However, with the increased European colonization of North America, Native Americans were displaced and often killed during conflicts.[67]

European settlers also began trafficking African slaves into Colonial America via the transatlantic slave trade.[68] By the turn of the 18th century, slavery had supplanted indentured servitude as the main source of agricultural labor for the cash crops in the American South.[69] Colonial society was divided over the religious and moral implications of slavery, and several colonies passed acts for or against the practice.[70][71]

The Thirteen Colonies[l] that would become the United States of America were administered by the British as overseas dependencies.[72] All nonetheless had local governments with elections open to white male property owners, except Jews and Catholics in some areas.[73][74] With very high birth rates, low death rates, and steady settlement, the colonial population grew rapidly, eclipsing Native American populations.[75] The Christian revivalist movement of the 1730s and 1740s known as the Great Awakening fueled interest both in religion and in religious liberty.[76]

During the Seven Years' War (1756–1763), known in the U.S. as the French and Indian War, British forces captured Canada from the French. The Treaty of Paris (1763) created a much smaller Province of Quebec, which still included the Ohio valley and the upper Mississippi valley, thereby isolating Canada's francophone population from the English-speaking colonial dependencies of Nova Scotia, Newfoundland and the Thirteen Colonies.[relevant?] Excluding the Native Americans who lived there, the Thirteen Colonies had a population of over 2.1 million in 1770, about a third that of Britain. Despite continuing new arrivals, the rate of natural increase was such that by the 1770s only a small minority of Americans had been born overseas.[77] The colonies' distance from Britain had allowed the development of self-government, but their unprecedented success motivated British monarchs to periodically seek to reassert royal authority.[78]

Revolutionary period (1763–1789)
Main articles: History of the United States (1776–1789) and 1789–1849
Further information: American Revolution, American Revolutionary War, and Confederation period
See caption
Declaration of Independence, a painting by John Trumbull, depicts the Committee of Five[m] presenting the draft of the Declaration to the Continental Congress, June 28, 1776, in Philadelphia.
The American Revolution separated the Thirteen Colonies from the British Empire, and included the first successful war of independence by a non-European entity against a European power in modern history. By the 18th century the American Enlightenment and the political philosophies of liberalism were pervasive among leaders. Americans began to develop an ideology of "republicanism", asserting that government rested on the consent of the governed. They demanded their "rights as Englishmen" and "no taxation without representation".[79][80] The British insisted on administering the colonies through a Parliament that did not have a single representative responsible for any American constituency, and the conflict escalated into war.[81]

In 1774, the First Continental Congress passed the Continental Association, which mandated a colonies-wide boycott of British goods. The American Revolutionary War began the following year, catalyzed by events like the Stamp Act and the Boston Tea Party that were rooted in colonial disagreement with British governance.[citation needed] The Second Continental Congress, an assembly representing the United Colonies, unanimously adopted the Declaration of Independence on July 4, 1776 (annually celebrated as Independence Day).[82] The Declaration stated: "We hold these truths to be self-evident, that all men are created equal, that they are endowed by their Creator with certain unalienable Rights, that among these are Life, Liberty and the pursuit of Happiness." Stephen Lucas called it "one of the best-known sentences in the English language",[83] with historian Joseph Ellis writing that the document contains "the most potent and consequential words in American history".[84] During the British Colonial era, slavery was legal in all of the American colonies, composed a longstanding institution in world history, and "challenges to its moral legitimacy were rare". However, during the Revolution, many in the colonies began to question the practice.[85]

In 1781, the Articles of Confederation and Perpetual Union established a decentralized government that operated until 1789.[82] In 1777, the American victory at the Battle of Saratoga resulted in the capture of a British army, and led to France and their ally Spain joining in the war against them. After the surrender of a second British army at the siege of Yorktown in 1781, Britain signed a peace treaty. American sovereignty became internationally recognized, and the new nation took possession of substantial territory east of the Mississippi River, from what is today Canada in the north and Florida in the south.[86]

As it became increasingly apparent that the Confederation was insufficient to govern the new country, nationalists advocated for and led the Philadelphia Convention of 1787 in writing the United States Constitution to replace it, ratified in state conventions in 1788.

Early national period (1789–1849)
Main article: History of the United States (1789–1849)
The U.S. Constitution is the oldest and longest-standing written and codified national constitution in force today.[87] Going into force in 1789, it reorganized the government into a federation administered by three branches (executive, judicial, and legislative), on the principle of creating salutary checks and balances. George Washington, who had led the Continental Army to victory and then willingly relinquished power, was the first President elected under the new constitution. The Bill of Rights, forbidding federal restriction of personal freedoms and guaranteeing a range of legal protections, was adopted in 1791.[88] The 1803 Louisiana Purchase almost doubled the nation's area.[89] Tensions with Britain remained, leading to the War of 1812, which was fought to a draw.[90] Spain ceded Florida and other Gulf Coast territory in 1819.[91]


William L. Sheppard "First Use of a Cotton Gin" (1790–1800), Harper's weekly, Dec. 18, 1869
Regional divisions over slavery grew in the proceeding decades. In the North, several prominent Founding Fathers such as John Adams, Roger Sherman, Alexander Hamilton, John Jay, and Benjamin Franklin advocated for the abolition of slavery, and by the 1810s every state in the region had, with these emancipations being the first in the Atlantic World.[92] The Missouri Compromise (1820) admitted Missouri as a slave state and Maine as a free state and declared a policy of prohibiting slavery in the remaining Louisiana Purchase lands north of the 36°30′ parallel. The outcome de facto sectionalized the country into two factions: free states, which forbade slavery; and slave states, which protected the institution; it was controversial, widely seen as dividing the country along sectarian lines.[93]

In the South, the invention of the cotton gin spurred entrenchment of slavery, with regional elites and intellectuals increasingly viewing the institution as a positive good instead of a necessary evil.[94] Although the federal government outlawed American participation in the Atlantic slave trade in 1807, after 1820, cultivation of the highly profitable cotton crop exploded in the Deep South, and along with it, the use of slave labor.[95][96][97] The Second Great Awakening, especially in the period 1800–1840, converted millions to evangelical Protestantism. In the North, it energized multiple social reform movements, including abolitionism;[98] in the South, Methodists and Baptists proselytized among slave populations.[99]



An animation of US territorial expansion over time.
In the late 18th century, American settlers began to expand further westward, some of them with a sense of manifest destiny.[100][101] The 1803 Louisiana Purchase almost doubled the nation's area,[102] Spain ceded Florida and other Gulf Coast territory in 1819,[103] the Republic of Texas was annexed in 1845 during a period of expansionism,[101] and the 1846 Oregon Treaty with Britain led to U.S. control of the present-day American Northwest.[104]

As it expanded further into land inhabited by Native Americans, the federal government often applied policies of Indian removal or assimilation.[105][106] The Trail of Tears in the 1830s exemplified the Indian removal policy that forcibly resettled Indians. The displacement prompted a long series of American Indian Wars west of the Mississippi River[107] and eventually conflict with Mexico.[108] Most of these conflicts ended with the cession of Native American territory and their confinement to Indian reservations. Victory in the Mexican–American War resulted in the 1848 Mexican Cession of California and much of the present-day American Southwest, with the U.S. now spanning the continent.[100][109] The California Gold Rush of 1848–1849 spurred migration to the Pacific coast, which led to the California Genocide[110] and the creation of additional western states.[111]

US expansion increased acreage under mechanical cultivation and surpluses for international markets grew. Economic development was spurred by giving vast quantities of land, nearly 10% of the total area of the United States, to white European settlers as part of the Homestead Acts, as well as making land grants to private railroad companies and colleges.[112] Prior to the Civil War, the prohibition or expansion of slavery into these territories exacerbated tensions over the debate around abolitionism.

Civil War and Reconstruction (1849–1877)
Main article: History of the United States (1849–1865)
Further information: Slave states and free states, American Civil War, and Reconstruction era
See also: Lost Cause of the Confederacy
Map of U.S. showing two kinds of Union states, two phases of secession and territories
Status of the states, 1861
   Slave states that seceded before April 15, 1861
   Slave states that seceded after April 15, 1861
   Union states that permitted slavery (border states)
   Union states that banned slavery
   Territories
Irreconcilable sectional conflict regarding the enslavement of those of black African descent[113] was the primary cause of the American Civil War.[114] With the 1860 election of Republican Abraham Lincoln, conventions in eleven slave states—all in the Southern United States—declared secession and formed the Confederate States of America, while the federal government (the "Union") maintained that secession was unconstitutional and illegitimate.[115] On April 12, 1861, the Confederacy initiated military conflict by bombarding Fort Sumter, a federal garrison in Charleston harbor, South Carolina. The ensuing Civil War (1861–1865) was the deadliest military conflict in American history resulting in the deaths of approximately 620,000 soldiers from both sides and upwards of 50,000 civilians, almost all of them in the South.[116]

Reconstruction began in earnest following the defeat of the Confederates. While President Lincoln attempted to foster cooperation and reconciliation between the Union and the former Confederacy, his assassination on April 14, 1865 drove a wedge between North and South again.[citation needed] Republicans in the federal government made it their goal to oversee the rebuilding of the South and to ensure the rights of African Americans, and the so-called Reconstruction Amendments to the Constitution guaranteed the abolishment of slavery, full citizenship to Americans of African descent, and suffrage for adult Black males. They persisted until the Compromise of 1877, when the Republicans agreed to cease enforcing the rights of African Americans in the South in order for Democrats to concede the presidential election of 1876.[citation needed] Influential Southern whites, calling themselves "Redeemers", took local control of the South after the end of Reconstruction, beginning the nadir of American race relations. From 1890 to 1910, the Redeemers established so-called Jim Crow laws, disenfranchising almost all blacks and some impoverished whites throughout the region. Blacks would face racial segregation nationwide, especially in the South.[117] They also lived under constant threat of vigilante violence, including lynching.[118]

Gilded Age, Progressive Era, and World War I (1877–1929)
Main article: History of the United States (1865–1918)
Further information: United States in World War I, Economic history of the United States, Immigration to the United States, Technological and industrial history of the United States, Gilded Age, and Progressive Era
2:43
Film by Edison Studios showing immigrants at Ellis Island in New York Harbor, that was a major entry point for European immigration into the U.S.[119]
National infrastructure, including telegraph and transcontinental railroads, spurred economic growth and greater settlement and development of the American Old West. After the American Civil War, new transcontinental railways made relocation easier for settlers, expanded internal trade, and increased conflicts with Native Americans.[120]

Mainland expansion also included the purchase of Alaska from Russia in 1867.[121] In 1893, pro-American elements in Hawaii overthrew the Hawaiian monarchy and formed the Republic of Hawaii, which the U.S. annexed in 1898. Puerto Rico, Guam, and the Philippines were ceded by Spain in the same year, by the Treaty of Paris (1898) following the Spanish–American War.[122] Neither the Foraker Act (1900), nor the Insular Cases (1901) accorded US citizenship to Puerto Ricans. One month prior to American entry into World War I, citizenship was extended to Puerto Ricans via the Jones–Shafroth Act (1917).[123]: 60–63  In November 1903, the US acquired a perpetual lease of the Panama Canal Zone via the Hay–Bunau-Varilla Treaty after providing naval aid preventing Colombia from putting down the rebellion which led to the creation of an independent Panama. The logistics of the November uprising were prepared in New York.[123]: 67  American Samoa was acquired by the United States in 1900 after the end of the Second Samoan Civil War.[124] The U.S. Virgin Islands were purchased from Denmark in 1917.[125]


Workers mass producing automobiles on an assembly line in Chicago in 1913.[126]
Rapid economic development during the late 19th and early 20th centuries fostered the rise of many prominent industrialists. Tycoons like Cornelius Vanderbilt, John D. Rockefeller, and Andrew Carnegie led the nation's progress in the railroad, petroleum, and steel industries. Banking became a major part of the economy, with J. P. Morgan playing a notable role. The United States also emerged as a pioneer of the automotive industry in the early 20th century.[127] In the North, urbanization and an unprecedented influx of immigrants from Southern and Eastern Europe supplied a surplus of labor for the country's industrialization.[128] Electric light and the telephone drastically changed communication and urban life.[129]

The American economy boomed, becoming the world's largest.[130] These dramatic changes were accompanied by significant increases in economic inequality, immigration, and social unrest, which prompted the rise of organized labor along with populist, socialist, and anarchist movements.[131][132][133] This period eventually ended with the advent of the Progressive Era, which saw significant reforms including health and safety regulation of consumer goods, the rise of labor unions, and greater antitrust measures to ensure competition among businesses and attention to worker conditions. The Great Migration beginning around 1910 also brought millions of African Americans to Northern urban centers from the rural South.[134]


The newly constructed Empire State Building in midtown Manhattan, 1932
The last vestiges of the Progressive Era resulted in women's suffrage and alcohol prohibition.[135][136][137] The first state to grant women the right to vote was Wyoming, in 1869, followed by some other states[138] before the women's rights movement won passage of a constitutional amendment granting nationwide women's suffrage in 1920.[139] The United States remained neutral from the outbreak of World War I in 1914 until 1917 when it joined the war as an "associated power" alongside the Allies of World War I, helping to turn the tide against the Central Powers. In 1919, President Woodrow Wilson took a leading diplomatic role at the Paris Peace Conference and advocated strongly for the U.S. to join the League of Nations. However, the Senate refused to approve this and did not ratify the Treaty of Versailles that established the League of Nations.[140]

Great Depression, New Deal, and World War II (1929–1945)
Main article: History of the United States (1918–1945)
Further information: Roaring Twenties, Great Depression in the United States, United States home front during World War II, and Military history of the United States during World War II
The 1920s and 1930s saw the rise of radio for mass communication and the invention of early television.[141] The prosperity of the Roaring Twenties ended with the Wall Street Crash of 1929 and the onset of the Great Depression. After his election as President in 1932, Franklin D. Roosevelt responded with the New Deal economic policies.[142] The Dust Bowl of the mid-1930s impoverished many farming communities and spurred a new wave of western migration.[143]


Mushroom cloud formed by the Trinity Experiment in New Mexico, part of the Manhattan Project, the first detonation of a nuclear weapon in history, July 1945
At first neutral during World War II, the United States began supplying war material to the Allies in March 1941. A total of $50.1 billion (equivalent to $719 billion in 2021) worth of supplies was shipped in 1941–1945, or 17% of the total war expenditures of the U.S.[144] On December 7, 1941, the Empire of Japan launched a surprise attack on Pearl Harbor, prompting the United States to militarily join the Allies against the Axis powers, and in the following year, to intern about 120,000 Japanese and Japanese Americans.[145][146] The U.S. pursued a "Europe first" defense policy,[147] with the Philippines being invaded and occupied by Japan until the country's liberation by the U.S.-led forces in 1944–1945. During the war, the United States was one of the "Four Policemen"[148] who met to plan the postwar world, along with Britain, the Soviet Union, and China.[149][150] The United States emerged relatively unscathed from the war, and with even greater economic and military influence.[151]

The United States played a leading role in the Bretton Woods and Yalta conferences, which signed agreements on new international financial institutions and Europe's postwar reorganization. As an Allied victory was achieved in Europe, a 1945 international conference held in San Francisco produced the United Nations Charter, which became active after the war.[152] The United States developed the first nuclear weapons and used them on Japan in the cities of Hiroshima and Nagasaki in August 1945; the Japanese subsequently surrendered on September 2, ending World War II.[153][154]

Cold War (1945–1990)
Main articles: History of the United States (1945–1964), 1964–1980, 1980–1991, and 1991–2008

Post–World War II economic expansion in the U.S. led to suburban development and urban sprawl, as shown in this aerial photograph of Levittown, Pennsylvania, c. 1959.
After World War II, the United States financed and implemented the Marshall Plan to help rebuild and economically revive war-torn Europe; disbursements paid between 1948 and 1952 would total $13 billion ($115 billion in 2021).[155] Also at this time, geopolitical tensions between the United States and Soviet Russia led to the Cold War, driven by an ideological divide between capitalism and communism.[156] The two countries dominated the military affairs of Europe, with the U.S. and its NATO allies on one side and the Soviet Union and its Warsaw Pact satellite states on the other.[157] Unlike the US, the USSR concentrated on its own recovery, seizing and transferring most of Germany's industrial plants, and it exacted war reparations from its Soviet Bloc satellites using Soviet-dominated joint enterprises.[n][158] The U.S. sometimes opposed Third World movements that it viewed as Soviet-sponsored, occasionally pursuing direct action for regime change against left-wing governments.[159] American troops fought the communist forces in the Korean War of 1950–1953,[160] and the U.S. became increasingly involved in the Vietnam War (1955–1975), introducing combat forces in 1965.[161] Their competition to achieve superior spaceflight capability led to the Space Race, which culminated in the U.S. becoming the first and only nation to land people on the Moon in 1969.[160] While both countries engaged in proxy wars and developed powerful nuclear weapons, they avoided direct military conflict.[157]

At home, the United States experienced sustained economic expansion, urbanization, and a rapid growth of its population and middle class following World War II. Construction of an Interstate Highway System transformed the nation's transportation infrastructure in decades to come.[162][163] In 1959, the United States admitted Alaska and Hawaii to become the 49th and 50th states, formally expanding beyond the contiguous United States.[164]

See caption
Martin Luther King Jr. gives his famous "I Have a Dream" speech at the Lincoln Memorial during the March on Washington, 1963.
The growing civil rights movement used nonviolence to confront racism, with Martin Luther King Jr. becoming a prominent leader.[165] President Lyndon B. Johnson initiated legislation that led to a series of policies addressing poverty and racial inequalities, in what he termed the "Great Society". The launch of a "War on Poverty" expanded entitlements and welfare spending, leading to the creation of the Food Stamp Program, Aid to Families with Dependent Children, along with national health insurance programs Medicare and Medicaid.[166] A combination of court decisions and legislation, culminating in the Civil Rights Act of 1968, made significant improvements.[167][168][169] Meanwhile, a counterculture movement grew, which was fueled by opposition to the Vietnam War, mainstream experimentation with psychedelics and cannabis, the Black Power movement, and the sexual revolution.[170] The women's movement in the U.S. broadened the debate on women's rights and made gender equality a major social goal. The 1960s Sexual Revolution liberalized American attitudes to sexuality and eventually spread to the rest of the developed world,[171][172] and the 1969 Stonewall riots in New York City marked the beginning of the modern gay rights movement in the West.[173][174]

The United States supported Israel during the Yom Kippur War; in response, the country faced an oil embargo from OPEC nations, sparking the 1973 oil crisis. The presidency of Richard Nixon saw the American withdrawal from Vietnam but also the Watergate scandal, which led to his resignation and a decline in public trust of government that expanded for decades.[175] After a surge in female labor participation around the 1970s, by 1985, the majority of women aged 16 and over were employed.[176] The 1970s and early 1980s also saw the onset of stagflation.


U.S. President Ronald Reagan (left) and Soviet general secretary Mikhail Gorbachev at the Geneva Summit in 1985
After his election in 1980, President Ronald Reagan responded to economic stagnation with neoliberal reforms and accelerated the rollback strategy towards the Soviet Union after its invasion of Afghanistan.[177][178][179][180] During Reagan's presidency, the federal debt held by the public nearly tripled in nominal terms, from $738 billion to $2.1 trillion.[181] This led to the United States moving from the world's largest international creditor to the world's largest debtor nation.[182] The collapse of the USSR's network of satellite states in Eastern Europe in 1989 and the subsequent dissolution of the country itself in 1991 ended the Cold War with American victory,[183][184][185][186] ensuring a global unipolarity[187] in which the U.S. was unchallenged as the world's sole superpower.[188]

Contemporary period (1990–present)
Main articles: History of the United States (1991–2008) and 2008–present
Fearing the spread of regional international instability from the Iraqi invasion of Kuwait, in August 1991, President George H. W. Bush launched and led the Gulf War against Iraq, expelling Iraqi forces and dissolving the Iraqi-backed puppet state in Kuwait.[189] During the administration of President Bill Clinton in 1994, the U.S. signed the North American Free Trade Agreement (NAFTA), causing trade among the U.S., Canada, and Mexico to soar.[190] Due to the dot-com boom, stable monetary policy, and reduced social welfare spending, the 1990s saw the longest economic expansion in modern U.S. history.[191]


The World Trade Center in Lower Manhattan, New York City after the September 11 attacks in 2001.
On September 11, 2001, al-Qaeda terrorist hijackers flew passenger planes into the World Trade Center in New York City and the Pentagon near Washington, D.C., killing nearly 3,000 people.[192] In response, President George W. Bush launched the war on terror, which included a nearly 20-year war in Afghanistan from 2001 to 2021 and the 2003–2011 Iraq War.[193][194] Government policy designed to promote affordable housing,[195] widespread failures in corporate and regulatory governance,[196] and historically low interest rates set by the Federal Reserve[197] led to a housing bubble in 2006. This culminated in the financial crisis of 2007–2008 and the Great Recession, the nation's largest economic contraction since the Great Depression.[198]

Barack Obama, the first multiracial[199] President with African-American ancestry, was elected in 2008 amid the financial crisis.[200] By the end of his second term, the stock market, median household income and net worth, and the number of persons with jobs were all at record levels, while the unemployment rate was well below the historical average.[201][202][203][204][205] His signature legislative accomplishment was the Affordable Care Act (ACA), popularly known as "Obamacare". It represented the U.S. health care system's most significant regulatory overhaul and expansion of coverage since Medicare in 1965. As a result, the uninsured share of the population was cut in half, while the number of newly insured Americans was estimated to be between 20 and 24 million.[206] After Obama served two terms, Republican Donald Trump was elected as the 45th president in 2016. His election is viewed as one of the biggest political upsets in American and world history.[207] Trump held office through the first waves of the COVID-19 pandemic and the resulting COVID-19 recession starting in 2020 that exceeded even the Great Recession earlier in the century.[208]

Political polarization increased beginning in the 2010s, with abortion access, same-sex marriage, the transgender rights movement, lingering systemic racism, police brutality, undocumented immigration, mass shootings and recreational marijuana use becoming central topics of debate. Several protests have since become among the largest in U.S. history.[209][210] On January 6, 2021, supporters of the outgoing President Trump stormed the U.S. Capitol in an unsuccessful effort to disrupt the Electoral College vote count that would confirm Democrat Joe Biden as the 46th president.[211] In 2022, the Supreme Court ruled that there is no constitutional right to an abortion, causing another wave of protests.[212] The United States responded to Russia and Belarus after their invasion of Ukraine, with the country applying harsh sanctions on Russia and sending tens of billions of dollars of military and humanitarian aid to Ukraine.[213]

Geography
Main article: Geography of the United States

Topographic map of the United States
The 48 contiguous states and the District of Columbia occupy a combined area of 3,119,885 square miles (8,080,470 km2). Of this area, 2,959,064 square miles (7,663,940 km2) is contiguous land, composing 83.65% of total U.S. land area.[214][215] About 15% is occupied by Alaska, a state in northwestern North America, with the remainder in Hawaii, a state and archipelago in the central Pacific, and the five populated but unincorporated insular territories of Puerto Rico, American Samoa, Guam, the Northern Mariana Islands, and the U.S. Virgin Islands.[216] Measured by only land area, the United States is third in size behind Russia and China, and just ahead of Canada.[217]


Denali, or Mount McKinley, in Alaska, the highest mountain peak in North America
The United States is the world's third- or fourth-largest nation by total area (land and water), ranking behind Russia and Canada and nearly equal to China. The ranking varies depending on how two territories disputed by China and India are counted, and how the total size of the United States is measured.[c][218]

The coastal plain of the Atlantic seaboard gives way further inland to deciduous forests and the rolling hills of the Piedmont.[219] The Appalachian Mountains and the Adirondack massif divide the eastern seaboard from the Great Lakes and the grasslands of the Midwest.[220] The Mississippi–Missouri River, the world's fourth longest river system, runs mainly north–south through the heart of the country. The flat, fertile prairie of the Great Plains stretches to the west, interrupted by a highland region in the southeast.[220]

The Rocky Mountains, west of the Great Plains, extend north to south across the country, peaking at over 14,000 feet (4,300 m) in Colorado.[221] Farther west are the rocky Great Basin and deserts such as the Chihuahua, Sonoran, and Mojave.[222] The Sierra Nevada and Cascade mountain ranges run close to the Pacific coast, both ranges also reaching altitudes higher than 14,000 feet (4,300 m). The lowest and highest points in the contiguous United States are in the state of California,[223] and only about 84 miles (135 km) apart.[224] At an elevation of 20,310 feet (6,190.5 m), Alaska's Denali is the highest peak in the country and in North America.[225] Active volcanoes are common throughout Alaska's Alexander and Aleutian Islands, and Hawaii consists of volcanic islands. The supervolcano underlying Yellowstone National Park in the Rockies is the continent's largest volcanic feature.[226]

Climate
Main articles: Climate of the United States and Climate change in the United States

Köppen climate types of the U.S.
The United States, with its large size and geographic variety, includes most climate types. To the east of the 100th meridian, the climate ranges from humid continental in the north to humid subtropical in the south.[227]

The Great Plains west of the 100th meridian are semi-arid. Many mountainous areas of the American West have an alpine climate. The climate is arid in the Great Basin, desert in the Southwest, Mediterranean in coastal California, and oceanic in coastal Oregon and Washington and southern Alaska. Most of Alaska is subarctic or polar. Hawaii and the southern tip of Florida are tropical, as well as its territories in the Caribbean and the Pacific.[228]

States bordering the Gulf of Mexico are prone to hurricanes, and most of the world's tornadoes occur in the country, mainly in Tornado Alley areas in the Midwest and South.[229] Overall, the United States receives more high-impact extreme weather incidents than any other country in the world.[230]

Extreme weather has become more frequent in the U.S., with three times the number of reported heat waves as in the 1960s. Of the ten warmest years ever recorded in the 48 contiguous states, eight have occurred since 1998. In the American Southwest, droughts have become more persistent and more severe.[231]

Biodiversity and conservation

Main articles: Fauna of the United States and Flora of the United States
A bald eagle
The bald eagle has been the national bird of the United States since 1782.[232]
The U.S. is one of 17 megadiverse countries containing large numbers of endemic species: about 17,000 species of vascular plants occur in the contiguous United States and Alaska, and more than 1,800 species of flowering plants are found in Hawaii, few of which occur on the mainland.[233] The United States is home to 428 mammal species, 784 birds, 311 reptiles, and 295 amphibians,[234] and 91,000 insect species.[235]

There are 63 national parks which are managed by the National Park Service, and hundreds of other federally managed parks, forests, and wilderness areas managed by it and other agencies.[236] Altogether, the government owns about 28% of the country's land area,[237] mostly in the western states.[238] Most of this land is protected, though some is leased for oil and gas drilling, mining, logging, or cattle ranching, and about .86% is used for military purposes.[239][240]

Environmental issues include debates on oil and nuclear energy, dealing with air and water pollution, the economic costs of protecting wildlife,[further explanation needed] logging and deforestation,[241][242] and climate change.[243][244] The most prominent environmental agency is the Environmental Protection Agency (EPA), created by presidential order in 1970.[245] The idea of wilderness has shaped the management of public lands since 1964, with the Wilderness Act.[246] The Endangered Species Act of 1973 is intended to protect threatened and endangered species and their habitats, which are monitored by the United States Fish and Wildlife Service.[247]

As of 2020, the U.S. ranked 24th among 180 nations in the Environmental Performance Index.[248] The country joined the Paris Agreement on climate change in 2016, and has many other environmental commitments.[249] It withdrew from the Paris Agreement in 2020[250] but rejoined it in 2021.[251]

Government and politics
Main article: Politics of the United States
Further information: Political parties in the United States, Elections in the United States, Political ideologies in the United States, American patriotism, and American civil religion

The United States Capitol, where Congress meets: the Senate, left; the House, right

The White House, residence and workplace of the U.S. President

The Supreme Court Building, where the nation's highest court sits
The United States is a federal republic of 50 states, a federal district, five territories and several uninhabited island possessions.[252][253][254] It is the world's oldest surviving federation, and, according to the World Economic Forum, the oldest democracy as well.[255] It is a liberal representative democracy "in which majority rule is tempered by minority rights protected by law."[256] Major democracy indexes uniformly classify the country as a liberal democracy.[257] The 2022 Corruption Perceptions Index and Global Corruption Barometer rank the United States as having low levels of both actual and perceived corruption.[258][259]

The U.S. Constitution serves as the country's supreme legal document, establishing the structure and responsibilities of the federal government and its relationship with the individual states. The Constitution has been amended 27 times;[260] the first ten amendments (Bill of Rights) and the Fourteenth Amendment form the central basis of Americans' individual rights. All laws and governmental procedures are subject to judicial review, and any law can be voided if the courts determine that it violates the Constitution. The principle of judicial review, not explicitly mentioned in the Constitution, was established by the Supreme Court in Marbury v. Madison (1803).[261]

In the American federal system, sovereignty is shared between two levels of government: federal and state. Citizens of the states are also governed by local governments, which are administrative divisions of the states. The territories are administrative divisions of the federal government. Governance on many issues is decentralized, with widely differing state laws on abortion, cannabis, the death penalty,[o] guns, economic policy, and other issues.[265] States have increasingly restricted so-called "conversion therapy".[266][267] Prostitution is only legal in several counties of Nevada.[268]

The United States has operated under an uncodified informal two-party system for most of its history, although other parties have run candidates.[269] What the two major parties are has changed over time: the Republicans and Democrats presently are, and the country is currently in either the Fifth or Sixth Party System.[270] Both parties have no formal central organization at the national level that controls membership, elected officials or political policies; thus, each party has traditionally had factions and individuals that deviated from party positions.[271] Since the 2000s, the country has suffered from significant political polarization.[272]

Federal government
Main article: Government of the United States
The federal government comprises three branches, which are headquartered in Washington, D.C. and regulated by a system of checks and balances defined by the Constitution.[273]

Legislative: The bicameral Congress, made up of the Senate and the House of Representatives, makes federal law, declares war, approves treaties, has the power of the purse,[274] and has the power of impeachment, by which it can remove sitting members of the federal government.[275]
Executive: The president is the commander-in-chief of the military, can veto legislative bills before they become law (subject to congressional override), and appoints the members of the Cabinet (subject to Senate approval) and other officers, who administer and enforce federal laws and policies through their respective agencies.[276]
Judicial: The Supreme Court and lower federal courts, whose judges are appointed by the President with Senate approval, interpret laws and overturn those they find unconstitutional.[277]
The lower house, the House of Representatives, has 435 voting members, each representing a congressional district for a two-year term. House seats are apportioned among the states by population. Each state then draws single-member districts to conform with the census apportionment. The District of Columbia and the five major U.S. territories each have one member of Congress—these members are not allowed to vote.[278]

The upper house, the Senate, has 100 members with each state having two senators, elected at large to six-year terms; one-third of Senate seats are up for election every two years. The District of Columbia and the five major U.S. territories do not have senators.[278] The Senate is unique among upper houses in being the most prestigious and powerful portion of the country's bicameral system; political scientists have frequently labeled it the "most powerful upper house" of any government.[279]

The President serves a four-year term and may be elected to the office no more than twice. The President is not elected by direct vote, but by an indirect electoral college system in which the determining votes are apportioned to the states and the District of Columbia.[280] The Supreme Court, led by the chief justice of the United States, has nine members, who serve for life. They are appointed by the sitting President when a vacancy becomes available.[281]

Political subdivisions
Main articles: Political divisions of the United States, State government in the United States, Local government in the United States, and U.S. state
Further information: List of states and territories of the United States, Indian reservation, and Territories of the United States
See also: Territorial evolution of the United States
Each of the 50 states holds jurisdiction over a geographic territory, where it shares sovereignty with the federal government. They are subdivided into counties or county equivalents, and further divided into municipalities. The District of Columbia is a federal district that contains the capital of the United States, the city of Washington.[282] Each state has an amount of presidential electors equal to the number of their representatives plus senators in Congress, and the District of Columbia has three electors.[283] Territories of the United States do not have presidential electors, therefore people there cannot vote for the president.[278]

Citizenship is granted at birth in all states, the District of Columbia, and all major U.S. territories except American Samoa.[p][287][284] The United States observes limited tribal sovereignty of the American Indian nations, like states' sovereignty. American Indians are U.S. citizens and tribal lands are subject to the jurisdiction of the U.S. Congress and the federal courts. Like the states, tribes have some autonomy restrictions. They are prohibited from making war, engaging in their own foreign relations, and printing or issuing independent currency.[288] Indian reservations are usually contained within one state, but there are 12 reservations that cross state boundaries.[289]

Map of USA with state names 2.svg
About this image
Foreign relations
Main articles: Foreign relations of the United States and Foreign policy of the United States
see caption
The United Nations headquarters has been situated along the East River in Midtown Manhattan since 1952. The United States is a founding member of the UN.
The United States has an established structure of foreign relations, and it had the world's second-largest diplomatic corps in 2019.[290] It is a permanent member of the United Nations Security Council,[291] and home to the United Nations headquarters.[292] The United States is also a member of the G7,[293] G20,[294] and OECD intergovernmental organizations.[295] Almost all countries have embassies and many have consulates (official representatives) in the country. Likewise, nearly all nations host formal diplomatic missions with United States, except Iran,[296] North Korea,[297] and Bhutan.[298] Though Taiwan does not have formal diplomatic relations with the U.S., it maintains close, if unofficial, relations.[299] The United States also regularly supplies Taiwan with military equipment to deter potential Chinese aggression.[300]

The United States has a "Special Relationship" with the United Kingdom[301] and strong ties with Canada,[302] Australia,[303] New Zealand,[304] the Philippines,[305] Japan,[306] South Korea,[307] Israel,[308] and several European Union countries (France, Italy, Germany, Spain, and Poland).[309] The U.S. works closely with its NATO allies on military and national security issues, and with nations in the Americas through the Organization of American States and the United States–Mexico–Canada Free Trade Agreement. In South America, Colombia is traditionally considered to be the closest ally of the United States.[310] The U.S. exercises full international defense authority and responsibility for Micronesia, the Marshall Islands, and Palau through the Compact of Free Association.[311] It has increasingly conducted strategic cooperation with India,[312] and its ties with China have steadily deteriorated.[313][314] The U.S. has become a key ally of Ukraine since Russia annexed Crimea in 2014 and began an invasion of Ukraine in 2022, significantly deteriorating relations with Russia in the process.[315][316]

Military
Main articles: United States Armed Forces and Military history of the United States

B-2 Spirit, the stealth heavy strategic bomber of the USAF

The Pentagon, near Washington, D.C., is home to the U.S. Department of Defense.
The President is the commander-in-chief of the United States Armed Forces and appoints its leaders, the secretary of defense and the Joint Chiefs of Staff. The Department of Defense, which is headquartered at the Pentagon near Washington, D.C., administers five of the six service branches, which are made up of the Army, Marine Corps, Navy, Air Force, and Space Force. The Coast Guard is administered by the Department of Homeland Security in peacetime and can be transferred to the Department of the Navy in wartime.[317] The United States spent $877 billion on its military in 2022, 39% of global military spending, accounting for 3.5% of the country's GDP.[318][319] The U.S. has more than 40% of the world's nuclear weapons, the second-largest amount after Russia.[320]

In 2019, all six branches of the U.S. Armed Forces reported 1.4 million personnel on active duty.[321] The Reserves and National Guard brought the total number of troops to 2.3 million.[321] The Department of Defense also employed about 700,000 civilians, not including contractors.[322] Military service in the United States is voluntary, although conscription may occur in wartime through the Selective Service System.[323] The United States has the third-largest combined armed forces in the world, behind the Chinese People's Liberation Army and Indian Armed Forces.[324]

Today, American forces can be rapidly deployed by the Air Force's large fleet of transport aircraft, the Navy's 11 active aircraft carriers, and Marine expeditionary units at sea with the Navy, and Army's XVIII Airborne Corps and 75th Ranger Regiment deployed by Air Force transport aircraft. The Air Force can strike targets across the globe through its fleet of strategic bombers, maintains the air defense across the United States, and provides close air support to Army and Marine Corps ground forces.[325][326]

The Space Force operates the Global Positioning System (GPS, also widespread in civilian use worldwide), the Eastern and Western Ranges for all space launches, and the United States's Space Surveillance and Missile Warning networks.[327][328][329] The military operates about 800 bases and facilities abroad,[330] and maintains deployments greater than 100 active duty personnel in 25 foreign countries.[331]

Law enforcement and crime
Main articles: Law enforcement in the United States and Crime in the United States
There are about 18,000 U.S. police agencies from local to federal level in the United States.[332] Law in the United States is mainly enforced by local police departments and sheriff's offices. The state police provides broader services, and federal agencies such as the Federal Bureau of Investigation (FBI) and the U.S. Marshals Service have specialized duties, such as protecting civil rights, national security and enforcing U.S. federal courts' rulings and federal laws.[333] State courts conduct most civil and criminal trials,[334] and federal courts handle designated crimes and appeals from the state criminal courts.[335]

As of 2020, the United States has an intentional homicide rate of 7 per 100,000 people.[336] A cross-sectional analysis of the World Health Organization Mortality Database from 2010 showed that United States homicide rates "were 7.0 times higher than in other high-income countries, driven by a gun homicide rate that was 25.2 times higher."[337]

As of January 2023, the United States has the sixth highest per-capita incarceration rate in the world, at 531 people per 100,000; and the largest prison and jail population in the world at 1,767,200.[338][339] In 2019, the total prison population for those sentenced to more than a year was 1,430,800, corresponding to a ratio of 419 per 100,000 residents and the lowest since 1995.[340] Some think tanks place that number higher, such as Prison Policy Initiative's estimate of 1.9 million.[341] Various states have attempted to reduce their prison populations via government policies and grassroots initiatives.[342]

Economy
Main article: Economy of the United States
Further information: Economic history of the United States, Taxation in the United States, United States federal budget, and Federal Reserve
see caption
The U.S. dollar (featuring George Washington) is the currency most used in international transactions and is the world's foremost reserve currency.[343]

The New York Stock Exchange on Wall Street, the world's largest stock exchange by market capitalization of its listed companies[344]

Midtown Manhattan, the world's largest central business district[345]
According to the International Monetary Fund, the U.S. gross domestic product (GDP) of $25.5 trillion constitutes over 25% of the gross world product at market exchange rates and over 15% of the gross world product at purchasing power parity (PPP).[346][14] From 1983 to 2008, U.S. real compounded annual GDP growth was 3.3%, compared to a 2.3% weighted average for the rest of the G7.[347] The country ranks first in the world by nominal GDP,[348] second by GDP (PPP),[14] seventh by nominal GDP per capita,[346] and eighth by GDP (PPP) per capita.[14] As of 2022, the United States was ranked 25th out of 169 countries on the Social Progress Index, which measures "the extent to which countries provide for the social and environmental needs of their citizens."[349] The U.S. has been the world's largest economy since at least 1900.[350]

The United States is at or near the forefront of technological advancement and innovation[351] in many economic fields, especially in artificial intelligence; computers; pharmaceuticals; and medical, aerospace and military equipment.[352] The nation's economy is fueled by abundant natural resources, a well-developed infrastructure, and high productivity.[353] It has the second-highest total-estimated value of natural resources, valued at US$44.98 trillion in 2019, although sources differ on their estimates. Americans have the highest average household and employee income among OECD member states.[354] In 2013, they had the sixth-highest median household income, down from fourth-highest in 2010.[355][356]

The U.S. dollar is the currency most used in international transactions and is the world's foremost reserve currency, backed by the country's dominant economy, its military, the petrodollar system, and its linked eurodollar and large U.S. treasuries market.[343] Several countries use it as their official currency and in others it is the de facto currency.[357][358] New York City is the world's principal financial center, with the largest economic output, and the epicenter of the principal American metropolitan economy.[359][360][361] The New York Stock Exchange and Nasdaq are the world's largest stock exchanges by market capitalization and trade volume.[362][363]

The largest U.S. trading partners are the European Union, Mexico, Canada, China, Japan, South Korea, the United Kingdom, Vietnam, India, and Taiwan.[364] The United States is the world's largest importer and the second-largest exporter after China.[365] It has free trade agreements with several countries, including the USMCA.[366] The U.S. ranked second in the Global Competitiveness Report in 2019, after Singapore.[367] Many of the world's largest companies, such as Alphabet (Google), Amazon, AT&T, Apple, Coca-Cola, Disney, General Motors, McDonald's, Nike, Meta, Microsoft, Pepsi, and Walmart, were founded and are headquartered in the United States.[368] Of the world's 500 largest companies, 124 are headquartered in the U.S.[368]

While its economy has reached a post-industrial level of development, the United States remains an industrial power.[369] As of 2018, the U.S. is the second-largest manufacturing nation after China.[370] In 2013, the U.S. national debt to GDP ratio surpassed 100% when both debt and GDP were approximately $16.7 trillion; in 2022, U.S. national debt was $30.93 trillion, while debt to GDP ratio was 124%.[371]

Income and poverty
Main articles: Income in the United States and Poverty in the United States
Further information: Affluence in the United States and Income inequality in the United States
At US$69,392 in 2020, the United States was ranked first in the world by average yearly wage based on the OECD data, and it had the world's highest median income at US$46,625 in 2021.[372][373] Despite the fact that the U.S. only accounted for 4.24% of the global population, residents of the U.S. collectively possessed 30.2% of the world's total wealth as of 2021, the largest percentage of any country.[374] The U.S. also ranks first in the number of dollar billionaires and millionaires, with 724 billionaires (as of 2021)[375] and nearly 22 million millionaires (2021).[376]

The United States has a smaller welfare state and redistributes less income through government action than most other high-income countries.[377] The U.S. ranked the 52nd highest in income inequality among 167 countries in 2014,[378] and the highest compared to the rest of the developed world in 2018.[379][380]

Wealth in the United States is highly concentrated; the richest 10% of the adult population own 72% of the country's household wealth, while the bottom 50% own just 2%.[381] Income inequality in the U.S. remains at record highs,[382] with the top fifth of earners taking home more than half of all income[383] and giving the U.S. one of the widest income distributions among OECD members.[384] The United States is the only advanced economy that does not guarantee its workers paid vacation nationally[385] and is one of a few countries in the world without federal paid family leave as a legal right.[386] The United States also has a higher percentage of low-income workers than almost any other developed nation, largely because of a weak collective bargaining system and lack of government support for at-risk workers.[387]

There were about 567,715 sheltered and unsheltered homeless persons in the U.S. in January 2019, with almost two-thirds staying in an emergency shelter or transitional housing program.[388] Attempts to combat homelessness include the Section 8 housing voucher program and implementation of the Housing First strategy across all levels of government.[389]

In 2011, 16.7 million children lived in food-insecure households, about 35% more than 2007 levels, though only 845,000 U.S. children (1.1%) saw reduced food intake or disrupted eating patterns at some point during the year, and most cases were not chronic.[390] As of June 2018, 40 million people, roughly 12.7% of the U.S. population, were living in poverty, including 13.3 million children;[380] the poverty threshold in the United States was at $12,880 for a single-person household and $26,246 for a family of four in 2021.[391][392] As of 2019, 2% of the U.S. population earned less than $10 per day.[393] 0.25% of the U.S. population lived below the international poverty line of $2.15 per day in 2020.[394][395]

Science, technology, and energy
Main articles: Science and technology in the United States, Science policy of the United States, and Energy in the United States

U.S. astronaut Buzz Aldrin saluting the flag on the Moon during the Apollo 11, 1969. The United States is the only country that has sent crewed missions to the lunar surface.
The United States has been a leader in technological innovation since the late 19th century and scientific research since the mid-20th century. Methods for producing interchangeable parts and the establishment of a machine tool industry enabled the U.S. to have large-scale manufacturing of sewing machines, bicycles, and other items in the late 19th century. In the early 20th century, factory electrification, the introduction of the assembly line, and other labor-saving techniques created the system of mass production.[396] In the 21st century, approximately two-thirds of research and development funding comes from the private sector.[397] In 2022, the United States was the country with the second-highest number of published scientific papers.[398] As of 2021, the U.S. ranked second by the number of patent applications, and third by trademark and industrial design applications.[399] In 2021, the United States launched a total of 51 spaceflights (China reported 55).[400] The U.S. had 2,944 active satellites in space in December 2021, the highest number of any country.[401]

In 1876, Alexander Graham Bell was awarded the first U.S. patent for the telephone. Thomas Edison's research laboratory developed the phonograph, the first long-lasting light bulb, and the first viable movie camera.[402] The Wright brothers in 1903 made the first sustained and controlled heavier-than-air powered flight, and the automobile companies of Ransom E. Olds (Oldsmobile) and Henry Ford (Ford Motor Company) popularized the assembly line in the early 20th century.[403] The rise of fascism and Nazism in the 1920s and 30s led many European scientists, such as Albert Einstein, Enrico Fermi, and John von Neumann, to immigrate to the United States.[404] During World War II, the Manhattan Project. developed nuclear weapons, ushering in the Atomic Age. During the Cold War, competition for superior missile capability led to the Space Race between the United States and Soviet Union.[405][406] The great American technological breakthroughs of the 20th century stem from the invention of the transistor in the 1950s, a key component in almost all modern electronics, which led to the development of microprocessors, software, personal computers, and the Internet.[407] In 2022, the United States ranked 2nd in the Global Innovation Index.[408] The United States also developed the Global Positioning System (GPS), the world's pre-eminent satellite navigation system.[409]

As of 2021, the United States receives approximately 79.1% of its energy from fossil fuels.[410] In 2021, the largest source of the country's energy came from petroleum (36.1%), followed by natural gas (32.2%), coal (10.8%), renewable sources (12.5%), and nuclear power (8.4%).[410] The United States constitutes less than 5% of the world's population, but consumes 17% of the world's energy.[411] It accounts for about 25% of the world's petroleum consumption, while producing only 6% of the world's annual petroleum supply.[412] The U.S. ranks as second-highest emitter of greenhouse gases, exceeded only by China.[413]

Transportation
Main article: Transportation in the United States

Hartsfield–Jackson Atlanta International Airport is the world's busiest by passenger traffic.[414]
The United States's rail network, nearly all standard gauge, is the longest in the world, and exceeds 293,564 km (182,400 mi).[415] It handles mostly freight, with intercity passenger service primarily provided by Amtrak, a government-managed company that took over services previously run by private companies, to all but four states.[416][417]

Personal transportation is dominated by automobiles,[418] which operate on a network of 4 million miles (6.4 million kilometers) of public roads, making it the longest network in the world.[419][420] The United States became the first country in the world to have a mass market for vehicle production and sales, and mass market production process.[421] As of 2022, the United States is the second-largest manufacturer of motor vehicles[422] and is home to Tesla, the world's most valuable car company.[423] General Motors held the title of the world's best-selling automaker from 1931 to 2008.[424] Currently, the U.S. has the world's second-largest automobile market by sales[425] and the highest vehicle ownership per capita in the world, with 816.4 vehicles per 1,000 Americans (2014).[426] In 2017, there were 255 million non-two wheel motor vehicles, or about 910 vehicles per 1,000 people.[427]

The civil airline industry is entirely privately owned and has been largely deregulated since 1978, while most major airports are publicly owned.[428] The three largest airlines in the world by passengers carried are U.S.-based; American Airlines is number one after its 2013 acquisition by US Airways.[429] Of the world's 50 busiest passenger airports, 16 are in the United States, including the top five and the busiest, Hartsfield–Jackson Atlanta International Airport.[430][431] As of 2020, there are 19,919 airports in the United States, of which 5,217 are designated as "public use", including for general aviation and other activities.[432]

Of the fifty busiest container ports, four are located in the United States, of which the busiest is the Port of Los Angeles.[433] The country's inland waterways are the world's fifth-longest, and total 41,009 km (25,482 mi).[434]

Demographics
Main articles: Americans, Demographics of the United States, Race and ethnicity in the United States, Religion in the United States, and Family structure in the United States
Population
See also: List of U.S. states by population
Historical population
Census	Pop.	Note	%±
1790	3,929,326		—
1800	5,308,483		35.1%
1810	7,239,881		36.4%
1820	9,638,453		33.1%
1830	12,866,020		33.5%
1840	17,069,453		32.7%
1850	23,191,876		35.9%
1860	31,443,321		35.6%
1870	38,925,598		23.8%
1880	50,189,209		28.9%
1890	62,979,766		25.5%
1900	76,212,168		21.0%
1910	92,228,496		21.0%
1920	106,021,537		15.0%
1930	122,775,046		15.8%
1940	132,164,569		7.6%
1950	150,697,361		14.0%
1960	179,323,175		19.0%
1970	203,392,031		13.4%
1980	226,545,805		11.4%
1990	248,709,873		9.8%
2000	281,421,906		13.2%
2010	308,745,538		9.7%
2020	331,449,281		7.4%
2022 (est.)	333,287,557	[435]	0.6%
U.S. Decennial Census
The U.S. Census Bureau reported 331,449,281 residents as of April 1, 2020,[q][436] making the United States the third most populous nation in the world, after China and India.[437] According to the Bureau's U.S. Population Clock, on January 28, 2021, the U.S. population had a net gain of one person every 100 seconds, or about 864 people per day.[438] In 2018, 52% of Americans age 15 and over were married, 6% were widowed, 10% were divorced, and 32% had never been married.[439] In 2021, the total fertility rate for the U.S. stood at 1.7 children per woman,[440] and it had the world's highest rate of children (23%) living in single-parent households in 2019.[441]

The United States has a diverse population; 37 ancestry groups have more than one million members.[442] White Americans with ancestry from Europe, the Middle East or North Africa, form the largest racial and ethnic group at 57.8% of the United States population.[443][444] Hispanic and Latino Americans form the second-largest group and are 18.7% of the United States population. African Americans constitute the nation's third-largest ancestry group and are 12.1% of the total United States population.[442] Asian Americans are the country's fourth-largest group, composing 5.9% of the United States population, while the country's 3.7 million Native Americans account for about 1%.[442] In 2020, the median age of the United States population was 38.5 years.[437]

Immigration
Main article: Immigration to the United States
The United States has by far the highest number of immigrant population in the world, with 50,661,149 people.[445][446] In 2018, there were almost 90 million immigrants and U.S.-born children of immigrants in the United States, accounting for 28% of the overall U.S. population.[447] In 2017, out of the U.S. foreign-born population, some 45% (20.7 million) were naturalized citizens, 27% (12.3 million) were lawful permanent residents, 6% (2.2 million) were temporary lawful residents, and 23% (10.5 million) were unauthorized immigrants.[448]

The United States led the world in refugee resettlement for decades, admitting more refugees than the rest of the world combined.[449]

Language
Main article: Languages of the United States
While many languages are spoken in the United States, English is the most common.[450] Although there is no official language at the federal level, some laws—such as U.S. naturalization requirements—standardize English, and most states have declared English as the official language.[451] Three states and four U.S. territories have recognized local or indigenous languages in addition to English, including Hawaii (Hawaiian),[452] Alaska (twenty Native languages),[r][453] South Dakota (Sioux),[454] American Samoa (Samoan), Puerto Rico (Spanish), Guam (Chamorro), and the Northern Mariana Islands (Carolinian and Chamorro).

In Puerto Rico, Spanish is more widely spoken than English.[455]

According to the American Community Survey, in 2010 some 229 million people (out of the total U.S. population of 308 million) spoke only English at home. More than 37 million spoke Spanish at home, making it the second most commonly used language in the United States. Other languages spoken at home by one million people or more include Chinese (2.8 million), Tagalog (1.6 million), Vietnamese (1.4 million), French (1.3 million), Korean (1.1 million), and German (1 million).[456]

The most widely taught foreign languages in the United States, in terms of enrollment numbers from kindergarten through university undergraduate education, are Spanish, French, and German. Other commonly taught languages include Latin, Japanese, American Sign Language, Italian, and Chinese.[457][458]

Religion
Main article: Religion in the United States
See also: List of religious movements that began in the United States
Self-identified religious affiliation in the United States (2023 The Wall Street Journal-NORC poll):[459]

  Protestantism (26%)
  Catholicism (21%)
  "Just Christian" (20%)
  Mormonism (2%)
  Unitarianism (1%)
  Judaism (2%)
  Buddhism (2%)
  Other religious affilation (2%)
  Islam (1%)
  Nothing in particular (12%)
  Agnosticism (8%)
  Atheism (4%)
Religious affiliation in the United States is among the most diverse in the world[460] and varies significantly by region[461] and age.[462]

The First Amendment guarantees the free exercise of religion and forbids Congress from passing laws respecting its establishment.[463][464] The country has the world's largest Christian population[465] and a majority of Americans identify as Christian, predominately Catholic, mainline Protestant, or evangelical. According to Gallup, 58% and 17% reporting praying often or sometimes, respectively, and 46% and 26% reporting that religion plays a very important or fairly important role, respectively, in their lives.[466] Most do not regularly attend religious services[459] and have low confidence in religious institutions.[467] Until the 1990s, the country was a significant outlier among highly developed countries, notably having a high level of religiosity and wealth, although this has lessened since.[468][469]

According to Gallup and Pew 81%-90% of Americans believe in a higher power[470][471] while "31% report attending a church, synagogue, mosque or temple weekly or nearly weekly today."[472] In the "Bible Belt", located within the Southern United States, evangelical Protestantism plays a significant role culturally. New England and the Western United States tend to be less religious.[461] Around 6% of Americans claim a non-Christian faith;[468] the largest of which are Judaism, Islam, Hinduism, and Buddhism.[473] The United States either has the first or second-largest Jewish population in the world, the largest outside of Israel.[474] "Ceremonial deism" is common in American culture.[463][475] Around 30% of Americans describe themselves as having no religion.[468] Membership in a house of worship fell from 70% in 1999 to 47% in 2020.[476]

Urbanization
Main articles: Urbanization in the United States and List of United States cities by population
About 82% of Americans live in urban areas, including suburbs;[218] about half of those reside in cities with populations over 50,000.[477] In 2008, 273 incorporated municipalities had populations over 100,000, nine cities had more than one million residents, and four cities (New York City, Los Angeles, Chicago, and Houston) had populations exceeding two million.[478] Many U.S. metropolitan populations are growing rapidly, particularly in the South and West.[479]
 vte
Largest metropolitan areas in the United States
2021 MSA population estimates from the U.S. Census Bureau
Rank	Name	Region	Pop.	Rank	Name	Region	Pop.	
New York
New York
Los Angeles
Los Angeles	1	New York	Northeast	19,768,458	11	Boston	Northeast	4,899,932	Chicago
Chicago
Dallas–Fort Worth
Dallas–Fort Worth
2	Los Angeles	West	12,997,353	12	Riverside–San Bernardino	West	4,653,105
3	Chicago	Midwest	9,509,934	13	San Francisco	West	4,623,264
4	Dallas–Fort Worth	South	7,759,615	14	Detroit	Midwest	4,365,205
5	Houston	South	7,206,841	15	Seattle	West	4,011,553
6	Washington, D.C.	South	6,356,434	16	Minneapolis–Saint Paul	Midwest	3,690,512
7	Philadelphia	Northeast	6,228,601	17	San Diego	West	3,286,069
8	Atlanta	South	6,144,050	18	Tampa–St. Petersburg	South	3,219,514
9	Miami	South	6,091,747	19	Denver	West	2,972,566
10	Phoenix	West	4,946,145	20	Baltimore	South	2,838,327
Education
Main articles: Education in the United States and Higher education in the United States
Photograph of the University of Virginia
The University of Virginia, founded by Thomas Jefferson, is one of the many public colleges and universities in the United States.
American public education is operated by state and local governments and regulated by the United States Department of Education through restrictions on federal grants. In most states, children are required to attend school from the age of five or six (beginning with kindergarten or first grade) until they turn 18 (generally bringing them through twelfth grade, the end of high school); some states allow students to leave school at 16 or 17.[480] Of Americans 25 and older, 84.6% graduated from high school, 52.6% attended some college, 27.2% earned a bachelor's degree, and 9.6% earned graduate degrees.[481] The basic literacy rate is approximately 99%.[218][482]

The United States has many private and public institutions of higher education. There are also local community colleges with generally more open admission policies, shorter academic programs, and lower tuition.[483] The U.S. spends more on education per student than any nation in the world,[484] spending an average of $12,794 per year on public elementary and secondary school students in the 2016–2017 school year.[485] As for public expenditures on higher education, the U.S. spends more per student than the OECD average, and more than all nations in combined public and private spending.[486] Despite some student loan forgiveness programs in place,[487] student loan debt has increased by 102% in the last decade,[488] and exceeded 1.7 trillion dollars as of 2022.[489]

The large majority of the world's top universities, as listed by various ranking organizations, are in the United States, including 19 of the top 25, and the most prestigious[weasel words][original research?] – the Harvard University.[490][491][492][493] The country also has by far the most Nobel Prize winners in history, with 403 (having won 406 awards).[494]

Health
See also: Health care in the United States, Health care reform in the United States, and Health insurance in the United States
The Texas Medical Center, a cluster of contemporary skyscrapers, at night
The Texas Medical Center in downtown Houston is the largest medical complex in the world.[495]
In a preliminary report, the Centers for Disease Control and Prevention (CDC) announced that U.S. life expectancy at birth had dropped to 76.4 years in 2021 (73.2 years for men and 79.1 years for women), down 0.9 years from 2020. This was the second year of overall decline, and the chief causes listed were the COVID-19 pandemic, accidents, drug overdoses, heart and liver disease, and suicides.[496][497] Life expectancy was highest among Asians and Hispanics and lowest among Blacks and American Indian–Alaskan Native (AIAN) peoples.[498][499] Starting in 1998, the average life expectancy in the U.S. fell behind that of other wealthy industrialized countries, and Americans' "health disadvantage" gap has been increasing ever since.[500] The U.S. also has one of the highest suicide rates among high-income countries,[501] and approximately one-third of the U.S. adult population is obese and another third is overweight.[502]

In 2010, coronary artery disease, lung cancer, stroke, chronic obstructive pulmonary diseases, and traffic collisions caused the most years of life lost in the U.S. Low back pain, depression, musculoskeletal disorders, neck pain, and anxiety caused the most years lost to disability. The most harmful risk factors were poor diet, tobacco smoking, obesity, high blood pressure, high blood sugar, physical inactivity, and alcohol consumption. Alzheimer's disease, substance use disorders, kidney disease, cancer, and falls caused the most additional years of life lost over their age-adjusted 1990 per-capita rates.[503] Teenage pregnancy and abortion rates in the U.S. are substantially higher than in other Western nations, especially among blacks and Hispanics.[504]

The U.S. health care system far outspends that of any other nation, measured both in per capita spending and as a percentage of GDP but attains worse health care outcomes when compared to peer nations.[505] The United States is the only developed nation without a system of universal health care, and a significant proportion of the population that does not carry health insurance.[506] The U.S., however, is a global leader in medical innovation, measured either in terms of revenue or the number of new drugs and devices introduced.[507][508] The Foundation for Research on Equal Opportunity ranked the United States 11th in its World Index of Healthcare Innovation; it concluded that the U.S. dominates science & technology, which "was on full display during the COVID-19 pandemic, as the U.S. government [delivered] coronavirus vaccines far faster than anyone had ever done before," but lags behind in fiscal sustainability, with "[government] spending [...] growing at an unsustainable rate."[509]

Government-funded health care coverage for the poor (Medicaid, established in 1965) and for those age 65 and older (Medicare, begun in 1966) is available to Americans who meet the programs' income or age qualifications. In 2010, former President Obama passed the Patient Protection and Affordable Care Act or ACA,[s][510] with the law roughly halving the uninsured share of the population according to the CDC.[511] Multiple studies have concluded that ACA had reduced the mortality of enrollees.[512][513][514] However, its legacy remains controversial.[515]

Culture and society
Main articles: Culture of the United States and Society of the United States
The Statue of Liberty, a large teal bronze sculpture on a stone pedestal
The Statue of Liberty (Liberty Enlightening the World), a gift from France, has become an iconic symbol of the American Dream.[516]
Americans have traditionally been characterized by a unifying belief in an "American creed" emphasizing liberty, equality under the law, democracy, social equality, property rights, and a preference for limited government.[517][518] Individualism,[519] having a strong work ethic,[520] competitiveness,[521] and altruism[522][523][524] are also cited values. According to a 2016 study by the Charities Aid Foundation, Americans donated 1.44% of total GDP to charity, the highest in the world by a large margin.[525] The United States is home to a wide variety of ethnic groups, traditions, and values,[526][527] and exerts major cultural influence on a global scale,[528][529] with the phenomenon being termed Americanization.[530] As such, the U.S. is considered a cultural superpower.[531]

Nearly all present Americans or their ancestors came from Eurafrasia ("the Old World") within the past five centuries.[532] Mainstream American culture is a Western culture largely derived from the traditions of European immigrants with influences from many other sources, such as traditions brought by slaves from Africa.[526][533] More recent immigration from Asia and especially Latin America has added to a cultural mix that has been described as a homogenizing melting pot, and a heterogeneous salad bowl, with immigrants contributing to, and often assimilating into, mainstream American culture.[526] The American Dream, or the perception that Americans enjoy high social mobility, plays a key role in attracting immigrants.[534] Whether this perception is accurate has been a topic of debate.[535][536][537] While mainstream culture holds that the United States is a classless society,[538] scholars identify significant differences between the country's social classes, affecting socialization, language, and values.[539] Americans tend to greatly value socioeconomic achievement, but being ordinary or average is promoted by some as a noble condition.[540]

The United States is considered to have the strongest protections of free speech of any country in the world under the First Amendment,[541] with the Supreme Court ruling that flag desecration, hate speech, blasphemy, and lese-majesty are all forms of protected expression.[542][543][544] A 2016 Pew Research Center poll found that Americans were the most supportive of free expression of any polity measured.[545] They are also the "most supportive of freedom of the press and the right to use the Internet without government censorship."[546] It is a socially progressive country[547] with permissive attitudes surrounding human sexuality.[548] LGBT rights in the U.S. are among the most advanced in the world.[548][549][550]

Literature and visual arts
Main articles: American literature, American philosophy, Architecture of the United States, and Visual art of the United States
Photograph of Mark Twain
Mark Twain, American author and humorist
In the 18th and early 19th centuries, American art and literature took most of their cues from Europe, contributing to Western culture. Writers such as Washington Irving, Nathaniel Hawthorne, Edgar Allan Poe, and Henry David Thoreau established a distinctive American literary voice by the middle of the 19th century. Mark Twain and poet Walt Whitman were major figures in the century's second half; Emily Dickinson, virtually unknown during her lifetime, is recognized as an essential American poet.[551]

In the 1920s, the New Negro Movement coalesced in Harlem, where many writers had migrated (some coming from the South, others from the West Indies). Its pan-African perspective was a significant cultural export during the Jazz Age in Paris and as such was a key early influence on the négritude philosophy.[552]

There have been a multitude of candidates for the "Great American Novel"—works seen as embodying and examining the essence and character of the United States—including Herman Melville's Moby-Dick (1851), Harriet Beecher Stowe's Uncle Tom's Cabin (1852), Twain's The Adventures of Huckleberry Finn (1885), F. Scott Fitzgerald's The Great Gatsby (1925), John Steinbeck's The Grapes of Wrath (1939), Harper Lee's To Kill a Mockingbird (1960), Toni Morrison's Beloved (1987), and David Foster Wallace's Infinite Jest (1996).[553][554][555]

Thirteen U.S. citizens have won the Nobel Prize in Literature, most recently Louise Glück, Bob Dylan, and Toni Morrison.[556] Earlier laureates William Faulkner, Ernest Hemingway and John Steinbeck have also been recognized as influential 20th century writers.[557]

In the visual arts, the Hudson River School was a mid-19th-century movement in the tradition of European naturalism. The 1913 Armory Show in New York City, an exhibition of European modernist art, shocked the public and transformed the U.S. art scene.[558] Georgia O'Keeffe, Marsden Hartley, and others experimented with new, individualistic styles, which would become known as American modernism.

Major artistic movements such as the abstract expressionism of Jackson Pollock and Willem de Kooning and the pop art of Andy Warhol and Roy Lichtenstein developed largely in the United States. The tide of modernism and then postmodernism has brought global fame to American architects such as Frank Lloyd Wright, Philip Johnson, and Frank Gehry.[559] Major photographers include Alfred Stieglitz, Edward Steichen, Dorothea Lange, Edward Weston, James Van Der Zee, Ansel Adams, and Gordon Parks.[560]

The most notable American architectural innovation has been the skyscraper. By some measures, what came to be known as a "skyscraper" in the modern world, first appeared in Chicago with the 1885 completion of the world's first largely steel-frame structure, the Home Insurance Building. One culturally significant early skyscraper was New York City's Woolworth Building designed by architect Cass Gilbert. Raising previous technological advances to new heights, 793 ft (233 m), it was the world's tallest building in 1913–1930.[561]

Cinema and theater
Main articles: Cinema of the United States and Theater in the United States
The Hollywood Sign, large white block letters on a hillside
The iconic Hollywood Sign in Los Angeles, California
The United States movie industry has a worldwide influence and following. Hollywood, a northern district of Los Angeles, California, is the leader in motion picture production and the most recognizable movie industry in the world.[562][563][564] The major film studios of the United States are the primary source of the most commercially successful and most ticket selling movies in the world.[565][566]

The world's first commercial motion picture exhibition was given in New York City in 1894, using the Kinetoscope.[567] Since the early 20th century, the U.S. film industry has largely been based in and around Hollywood, although in the 21st century an increasing number of films are not made there, and film companies have been subject to the forces of globalization.[568] The Academy Awards, popularly known as the Oscars, have been held annually by the Academy of Motion Picture Arts and Sciences since 1929,[569] and the Golden Globe Awards have been held annually since January 1944.[570]

Director D. W. Griffith, an American filmmaker during the silent film period, was central to the development of film grammar, and producer/entrepreneur Walt Disney was a leader in both animated film and movie merchandising.[571] Directors such as John Ford redefined the image of the American Old West, and, like others such as John Huston, broadened the possibilities of cinema with location shooting. The industry enjoyed its golden years, in what is commonly referred to as the "Golden Age of Hollywood", from the early sound period until the early 1960s,[572] with screen actors such as John Wayne and Marilyn Monroe becoming iconic figures.[573][574] In the 1970s, "New Hollywood" or the "Hollywood Renaissance"[575] was defined by grittier films influenced by French and Italian realist pictures of the post-war period.[576]

The 21st century has been marked by the rise of the American streaming platforms, such as Netflix, Disney+, Paramount+, and Apple TV+, which came to rival traditional cinema.[577][578]

Mainstream theater in the United States derives from the old European theatrical tradition and has been heavily influenced by the British theater.[579] The central hub of the American theater scene has been Manhattan, with its divisions of Broadway, off-Broadway, and off-off-Broadway.[580] Many movie and television stars have gotten their big break working in New York productions. Outside New York City, many cities have professional regional or resident theater companies that produce their own seasons, with some works being produced regionally with hopes of eventually moving to New York. The biggest-budget theatrical productions are musicals. U.S. theater also has an active community theater culture, which relies mainly on local volunteers who may not be actively pursuing a theatrical career.[581]

Music
Main article: Music of the United States

The Country Music Hall of Fame and Museum in Nashville, Tennessee
American folk music encompasses numerous music genres, variously known as traditional music, traditional folk music, contemporary folk music, or roots music. Many traditional songs have been sung within the same family or folk group for generations, and sometimes trace back to such origins as the British Isles, Mainland Europe, or Africa.[582]

Among the country's earliest composers was William Billings who, born in Boston, composed patriotic hymns in the 1770s;[583] Billings was a part of the First New England School, who dominated American music during its earliest stages. Anthony Heinrich was the most prominent composer before the Civil War. From the mid- to late 1800s, John Philip Sousa of the late Romantic era composed numerous military songs—particularly marches—and is regarded as one of the nation's greatest composers.[584]

The rhythmic and lyrical styles of African-American music have significantly influenced American music at large, distinguishing it from European and African traditions. The Smithsonian Institution states, "African-American influences are so fundamental to American music that there would be no American music without them."[585] Country music developed in the 1920s, and rhythm and blues in the 1940s. Elements from folk idioms such as the blues and what is known as old-time music were adopted and transformed into popular genres with global audiences. Jazz was developed by innovators such as Louis Armstrong and Duke Ellington early in the 20th century.[586] Known for singing in a wide variety of genres, Aretha Franklin is considered one of the all-time greatest American singers.[587]

Elvis Presley and Chuck Berry were among the pioneers of rock and roll in the mid-1950s. Rock bands such as Metallica, the Eagles, and Aerosmith are among the highest grossing in worldwide sales.[588][589][590] In the 1960s, Bob Dylan emerged from the folk revival to become one of the country's most celebrated songwriters.[591] Mid-20th-century American pop stars such as Bing Crosby, Frank Sinatra,[592] and Elvis Presley became global celebrities,[586] as have artists of the late 20th century such as Prince, Michael Jackson, Madonna, Whitney Houston, and Mariah Carey.[593][594] The musical forms of punk and hip hop both originated in the United States.[595] American professional opera singers have reached the highest level of success in that form, including Renée Fleming, Leontyne Price, Beverly Sills, Nelson Eddy, and many others.[596]

American popular music, as part of the wider U.S. pop culture, has a worldwide influence and following.[597] Beyoncé, Taylor Swift, Miley Cyrus, Ariana Grande, Eminem, Lady Gaga, Katy Perry, and many other contemporary artists dominate global streaming rankings.[598]

The United States has the world's largest music market with a total retail value of $4.9 billion in 2014.[599] The American music industry includes a number of fields, ranging from record companies to radio stations and community orchestras. Most of the world's major record companies are based in the U.S.; they are represented by the Recording Industry Association of America (RIAA).[600]

Mass media
Further information: Mass media in the United States
See also: Newspapers in the United States, Television in the United States, Internet in the United States, Radio in the United States, and Video games in the United States

The Comcast Center in Philadelphia, headquarters of the Comcast Corporation, which is the nation's largest multinational telecommunications conglomerate[citation needed]
The four major broadcasters in the U.S. are the National Broadcasting Company (NBC), Columbia Broadcasting System (CBS), American Broadcasting Company (ABC), and Fox Broadcasting Company (FOX). The four major broadcast television networks are all commercial entities. Cable television offers hundreds of channels catering to a variety of niches.[601] As of 2021, about 83% of Americans over age 12 listen to broadcast radio, while about 41% listen to podcasts.[602] As of September 30, 2014, there are 15,433 licensed full-power radio stations in the U.S. according to the U.S. Federal Communications Commission (FCC).[603] Much of the public radio broadcasting is supplied by NPR, incorporated in February 1970 under the Public Broadcasting Act of 1967.[604]

Internationally well-known U.S. newspapers include The Wall Street Journal, The New York Times, The Washington Post and USA Today.[605] More than 800 publications are produced in Spanish, the second most commonly used language in the United States behind English.[606][607] With very few exceptions, all the newspapers in the U.S. are privately owned, either by large chains such as Gannett or McClatchy, which own dozens or even hundreds of newspapers; by small chains that own a handful of papers; or, in a situation that is increasingly rare, by individuals or families. Major cities often have alternative newspapers to complement the mainstream daily papers, such as New York City's The Village Voice or Los Angeles' LA Weekly. The five most popular websites used in the U.S. are Google, YouTube, Amazon, Yahoo, and Facebook, with all of them being American companies.[608]

Widely regarded as the birthplace of the modern video gaming industry,[citation needed] the United States is the world's second-largest video game market by revenue.[609] Major publishers headquartered in the United States are Sony Interactive Entertainment, Take-Two, Activision Blizzard, Electronic Arts, Xbox Game Studios, Bethesda Softworks, Epic Games, Valve, Warner Bros., Riot Games, and others.[610][611] There are 444 publishers, developers, and hardware companies in California alone.[612]

Cuisine
Main article: American cuisine
Further information: List of American regional and fusion cuisines

A cheeseburger served with fries and coleslaw
Early settlers were introduced by Native Americans to such indigenous, non-European foods as turkey, sweet potatoes, corn, squash, and maple syrup. They and later immigrants combined these with foods they had known, such as wheat flour,[613] beef, and milk to create a distinctive American cuisine.[614][615] Homegrown foods are part of a shared national menu on one of America's most popular holidays, Thanksgiving, when many Americans make or purchase traditional foods to celebrate the occasion.[616] The American fast food industry, the world's first and largest, is also often viewed as being a symbol of U.S. marketing dominance. Companies such as McDonald's,[617] Burger King, Pizza Hut, Kentucky Fried Chicken, and Domino's Pizza among others, have numerous outlets around the world,[618] and pioneered the drive-through format in the 1940s.[619] Characteristic American dishes such as apple pie, fried chicken, doughnuts, french fries, macaroni and cheese, ice cream, pizza, hamburgers, and hot dogs derive from the recipes of various immigrants.[620][621] Mexican dishes such as burritos and tacos and pasta dishes freely adapted from Italian sources are widely consumed.[622]

American chefs have been influential both in the food industry and in popular culture. Some important 19th-century American chefs include Charles Ranhofer of Delmonico's Restaurant in New York, and Bob Payton, who is credited with bringing American-style pizza to the UK.[623] Later, chefs Charles Scotto, Louis Pacquet, John Massironi founded the American Culinary Federation in 1930, taking after similar organizations across Europe. In the 1940s, Chef James Beard hosted the first nationally televised cooking show I Love to Eat. His name is also carried by the foundation and prestigious cooking award recognizing excellence in the American cooking community.[624][625] Since Beard, many chefs and cooking personalities have taken to television, and the success of the Cooking Channel and Food Network have contributed to the popularity of American cuisine. Probably the best-known television chef was Julia Child who taught French cuisine in her weekly show, The French Chef.[626] In 1946, the Culinary Institute of America was founded by Katharine Angell and Frances Roth. This would become the United States' most prestigious culinary school, where many of the most talented American chefs would study prior to successful careers.[627][628]

Sports
Main article: Sports in the United States
See also: Professional sports leagues in the United States, National Collegiate Athletic Association, and United States at the Olympics

American football is the most popular sport in the United States.
The most popular spectator sports in the U.S. are American football, basketball, baseball, soccer, and ice hockey, according to a 2017 Gallup poll.[629] While most major U.S. sports such as baseball and American football have evolved out of European practices, basketball, volleyball, skateboarding, and snowboarding are American inventions, some of which have become popular worldwide.[630] Lacrosse and surfing arose from Native American and Native Hawaiian activities that predate European contact.[631] The market for professional sports in the United States was roughly $69 billion in July 2013, roughly 50% larger than that of all of Europe, the Middle East, and Africa combined.[632]

American football is by several measures the most popular spectator sport in the United States;[633] the National Football League (NFL) has the highest average attendance of any sports league in the world, and the Super Bowl is watched by tens of millions globally.[634] Baseball has been regarded as the U.S. national sport since the late 19th century, with Major League Baseball being the top league. Basketball and ice hockey are the country's next two most popular professional team sports, with the top leagues being the National Basketball Association and the National Hockey League, which are also the premier leagues worldwide for these sports. The most-watched individual sports in the U.S. are golf and auto racing, particularly NASCAR and IndyCar.[635][636] On the collegiate level, earnings for the member institutions exceed $1 billion annually,[637] and college football and basketball attract large audiences, as the NCAA Final Four is one of the most watched national sporting events.[638]

Eight Olympic Games have taken place in the United States. The 1904 Summer Olympics in St. Louis, Missouri, were the first-ever Olympic Games held outside of Europe.[639] The Olympic Games will be held in the U.S. for a ninth time when Los Angeles hosts the 2028 Summer Olympics. U.S. athletes have won a total of 2,959 medals (1,173 gold) at the Olympic Games, by far the most of any country.[640][641][642]

In international soccer, the men's national soccer team qualified for eleven World Cups, while the women's national team has won the FIFA Women's World Cup and Olympic soccer tournament four times each.[643] The United States hosted the 1994 FIFA World Cup and will host the 2026 FIFA World Cup along with Canada and Mexico.[644]

`