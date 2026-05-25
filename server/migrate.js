const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "biblioteca.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Converte número serial do Excel para string "YYYY-MM-DD"
function excelDateToISO(serial) {
  if (!serial || isNaN(serial)) return null;
  const date = new Date(Date.UTC(1899, 11, 30) + Number(serial) * 86400000);
  return date.toISOString().split("T")[0];
}

// Converte estrelas para número (ex: ★★★★½ → 4.5)
function starsToNumber(stars) {
  if (!stars || typeof stars !== "string") return 0;
  const full = (stars.match(/★/g) || []).length;
  const half = stars.includes("½") ? 0.5 : 0;
  return full + half;
}

// Converte status (✔️ = finished, ⏳ = reading, vazio = finished)
function parseStatus(finalizado) {
  if (!finalizado || finalizado === "") return "finished";
  if (finalizado.includes("⏳")) return "reading";
  if (finalizado.includes("📓")) return "paused";
  return "finished";
}

const insert = db.prepare(`
  INSERT INTO books (title, author, category, pages, year, status, start_date, end_date, rating)
  VALUES (@title, @author, @category, @pages, @year, @status, @start_date, @end_date, @rating)
`);

const books = [
  // ── 2022 (sem categoria) ──
  { title: "O Chamado de Cthulhu e Outros Contos", author: "H.P. Lovecraft",      category: "Terror",    pages: 152,  year: 2022, status: "finished", start_date: excelDateToISO(44608), end_date: excelDateToISO(44612), rating: starsToNumber("★★★★") },
  { title: "A Cor que Caiu do Céu",                author: "H.P. Lovecraft",      category: "Terror",    pages: 136,  year: 2022, status: "finished", start_date: excelDateToISO(44611), end_date: excelDateToISO(44612), rating: starsToNumber("★★★★½") },
  { title: "O Homem de Giz",                       author: "C.J. Tudor",          category: "Suspense",  pages: 272,  year: 2022, status: "finished", start_date: excelDateToISO(44614), end_date: excelDateToISO(44616), rating: starsToNumber("★★★★★") },
  { title: "Visão do Além",                        author: "Charlaine Harris",    category: "Ficção",    pages: 232,  year: 2022, status: "finished", start_date: excelDateToISO(44614), end_date: excelDateToISO(44615), rating: starsToNumber("★★★★★") },
  { title: "Surpresa do Além",                     author: "Charlaine Harris",    category: "Ficção",    pages: 255,  year: 2022, status: "finished", start_date: excelDateToISO(44621), end_date: excelDateToISO(44623), rating: starsToNumber("★★★★★") },
  { title: "O Que Aconteceu Com Annie",            author: "C.J. Tudor",          category: "Suspense",  pages: 288,  year: 2022, status: "finished", start_date: excelDateToISO(44624), end_date: excelDateToISO(44647), rating: starsToNumber("★★★★") },
  { title: "As Outras Pessoas",                    author: "C.J. Tudor",          category: "Suspense",  pages: 304,  year: 2022, status: "finished", start_date: excelDateToISO(44648), end_date: excelDateToISO(44650), rating: starsToNumber("★★★★★") },
  { title: "Mitologia Nórdica",                    author: "Neil Gaiman",         category: "Fantasia",  pages: 286,  year: 2022, status: "finished", start_date: excelDateToISO(44749), end_date: excelDateToISO(44749), rating: starsToNumber("★★★★½") },
  { title: "Coraline",                             author: "Neil Gaiman",         category: "Fantasia",  pages: 224,  year: 2022, status: "finished", start_date: excelDateToISO(44749), end_date: excelDateToISO(44750), rating: starsToNumber("★★★★★") },
  { title: "Assassinato no Expresso do Oriente",   author: "Agatha Christie",     category: "Mistério",  pages: 200,  year: 2022, status: "finished", start_date: excelDateToISO(44753), end_date: excelDateToISO(44758), rating: starsToNumber("★★★★★") },
  { title: "Mr. Mercedes",                         author: "Stephen King",        category: "Suspense",  pages: 393,  year: 2022, status: "finished", start_date: excelDateToISO(44754), end_date: excelDateToISO(44764), rating: starsToNumber("★★★★★") },
  { title: "Achados e Perdidos",                   author: "Stephen King",        category: "Suspense",  pages: 352,  year: 2022, status: "finished", start_date: excelDateToISO(44765), end_date: excelDateToISO(44770), rating: starsToNumber("★★★★★") },
  { title: "Billy Summers",                        author: "Stephen King",        category: "Suspense",  pages: 472,  year: 2022, status: "finished", start_date: excelDateToISO(44774), end_date: excelDateToISO(44787), rating: starsToNumber("★★★★★") },
  { title: "O Iluminado",                          author: "Stephen King",        category: "Terror",    pages: 464,  year: 2022, status: "finished", start_date: excelDateToISO(44774), end_date: excelDateToISO(44796), rating: starsToNumber("★★★★★") },
  { title: "Doutor Sono",                          author: "Stephen King",        category: "Terror",    pages: 480,  year: 2022, status: "finished", start_date: excelDateToISO(44796), end_date: excelDateToISO(44801), rating: starsToNumber("★★★★★") },
  { title: "1984",                                 author: "George Orwell",       category: "Ficção",    pages: 335,  year: 2022, status: "finished", start_date: excelDateToISO(44802), end_date: excelDateToISO(44806), rating: starsToNumber("★★★★★") },
  { title: "Misery, Louca Obsessão",               author: "Stephen King",        category: "Suspense",  pages: 326,  year: 2022, status: "finished", start_date: excelDateToISO(44807), end_date: excelDateToISO(44812), rating: starsToNumber("★★★★★") },
  { title: "God of War",                           author: "Matthew Woodring",    category: "Ação",      pages: 384,  year: 2022, status: "finished", start_date: excelDateToISO(44813), end_date: excelDateToISO(44831), rating: starsToNumber("★★★★") },
  { title: "Charlie, O Jovem Adulto",              author: "Ângulo de Vista",     category: "Outro",     pages: 128,  year: 2022, status: "finished", start_date: excelDateToISO(44891), end_date: excelDateToISO(44892), rating: starsToNumber("★★★★★") },
  { title: "O Livro Sagrado Pacão",                author: "Carlos Ruas",         category: "Outro",     pages: 96,   year: 2022, status: "finished", start_date: excelDateToISO(44893), end_date: excelDateToISO(44893), rating: starsToNumber("★★★★½") },
  { title: "Bíblia Gatólica",                      author: "Carlos Ruas",         category: "Outro",     pages: 96,   year: 2022, status: "finished", start_date: excelDateToISO(44893), end_date: excelDateToISO(44893), rating: starsToNumber("★★★★½") },
  { title: "A Máscara de Togi",                    author: "Mari Santos",         category: "Outro",     pages: 194,  year: 2022, status: "finished", start_date: excelDateToISO(44893), end_date: excelDateToISO(44893), rating: starsToNumber("★★★★★") },
  { title: "O Último Jogo",                        author: "Mari Santos",         category: "Outro",     pages: 22,   year: 2022, status: "finished", start_date: excelDateToISO(44911), end_date: excelDateToISO(44911), rating: starsToNumber("★★★★") },
  { title: "Guerra Civil",                         author: "Stuart Moore",        category: "HQ",        pages: 398,  year: 2022, status: "finished", start_date: excelDateToISO(44907), end_date: excelDateToISO(44911), rating: starsToNumber("★★★★★") },
  { title: "Último Turno",                         author: "Stephen King",        category: "Suspense",  pages: 384,  year: 2022, status: "finished", start_date: excelDateToISO(44912), end_date: excelDateToISO(44922), rating: starsToNumber("★★★★★") },

  // ── 2023 ──
  { title: "It, A Coisa",                                        author: "Stephen King",      category: "Terror",   pages: 1103, year: 2023, status: "finished", start_date: excelDateToISO(44927), end_date: excelDateToISO(44941), rating: starsToNumber("★★★★★") },
  { title: "O Iluminado",                                        author: "Stephen King",      category: "Mistério", pages: 520,  year: 2023, status: "finished", start_date: excelDateToISO(44942), end_date: excelDateToISO(44947), rating: starsToNumber("★★★★★") },
  { title: "A Longa Marcha",                                     author: "Stephen King",      category: "Ação",     pages: 288,  year: 2023, status: "finished", start_date: excelDateToISO(44948), end_date: excelDateToISO(44956), rating: starsToNumber("★★★★★") },
  { title: "O Urso",                                             author: "Claire Cameron",    category: "Aventura", pages: 256,  year: 2023, status: "finished", start_date: excelDateToISO(44948), end_date: excelDateToISO(44956), rating: starsToNumber("★") },
  { title: "Das Cinzas de Onira",                                author: "Umberto Mannarino", category: "Terror",   pages: 256,  year: 2023, status: "finished", start_date: excelDateToISO(44958), end_date: excelDateToISO(44985), rating: starsToNumber("★★★★★") },
  { title: "A Máquina do Tempo",                                 author: "H.G. Wells",        category: "Ficção",   pages: 144,  year: 2023, status: "finished", start_date: excelDateToISO(45012), end_date: excelDateToISO(45013), rating: starsToNumber("★★★★★") },
  { title: "Um Aviso ao Curioso e Outras Histórias",             author: "M.R. James",        category: "Ficção",   pages: 160,  year: 2023, status: "finished", start_date: excelDateToISO(45017), end_date: excelDateToISO(45021), rating: starsToNumber("★★★★½") },
  { title: "Outras Histórias de Fantasmas",                      author: "M.R. James",        category: "Ficção",   pages: 200,  year: 2023, status: "finished", start_date: excelDateToISO(45022), end_date: excelDateToISO(45026), rating: starsToNumber("★★★★½") },
  { title: "Histórias de Fantasmas de Um Antiquário",            author: "M.R. James",        category: "Terror",   pages: 184,  year: 2023, status: "finished", start_date: excelDateToISO(45027), end_date: excelDateToISO(45029), rating: starsToNumber("★★★★½") },
  { title: "Conto de Fadas",                                     author: "Stephen King",      category: "Ação",     pages: 624,  year: 2023, status: "finished", start_date: excelDateToISO(45020), end_date: excelDateToISO(45034), rating: starsToNumber("★★★★★") },
  { title: "Outsider",                                           author: "Stephen King",      category: "Aventura", pages: 528,  year: 2023, status: "finished", start_date: excelDateToISO(45035), end_date: excelDateToISO(45041), rating: starsToNumber("★★★★★") },
  { title: "Com Sangue",                                         author: "Stephen King",      category: "Terror",   pages: 400,  year: 2023, status: "finished", start_date: excelDateToISO(45047), end_date: excelDateToISO(45061), rating: starsToNumber("★★★★★") },
  { title: "O Horror de Dunwich e Outros Contos Extraordinários",author: "H.P. Lovecraft",    category: "Mistério", pages: 144,  year: 2023, status: "finished", start_date: excelDateToISO(45047), end_date: excelDateToISO(45061), rating: starsToNumber("★★★★") },
  { title: "Planeta Hulk",                                       author: "Greg Pak",          category: "HQ",       pages: 224,  year: 2023, status: "finished", start_date: excelDateToISO(45062), end_date: excelDateToISO(45065), rating: starsToNumber("★★★★★") },
  { title: "Drácula",                                            author: "Bram Stoker",       category: "Mistério", pages: 448,  year: 2023, status: "finished", start_date: excelDateToISO(45066), end_date: excelDateToISO(45076), rating: starsToNumber("★★★★★") },
  { title: "Doutor Sono",                                        author: "Stephen King",      category: "Terror",   pages: 480,  year: 2023, status: "finished", start_date: excelDateToISO(45133), end_date: excelDateToISO(45144), rating: starsToNumber("★★★★★") },
  { title: "Craveiro",                                           author: "Aikau Meloni",      category: "Aventura", pages: 32,   year: 2023, status: "finished", start_date: excelDateToISO(45144), end_date: excelDateToISO(45144), rating: starsToNumber("★★★★½") },
  { title: "Mr. Mercedes",                                       author: "Stephen King",      category: "Suspense", pages: 393,  year: 2023, status: "finished", start_date: excelDateToISO(45145), end_date: excelDateToISO(45151), rating: starsToNumber("★★★★★") },
  { title: "Abelua",                                             author: "Michel V.P",        category: "Infantil", pages: 16,   year: 2023, status: "finished", start_date: excelDateToISO(45145), end_date: excelDateToISO(45145), rating: starsToNumber("★★★★½") },
  { title: "Helldang",                                           author: "Airton",            category: "HQ",       pages: 30,   year: 2023, status: "finished", start_date: excelDateToISO(45152), end_date: excelDateToISO(45152), rating: starsToNumber("★★★★★") },
  { title: "Pap e Marry em Cadeia Alimentar",                    author: "Erick",             category: "HQ",       pages: 16,   year: 2023, status: "finished", start_date: excelDateToISO(45153), end_date: excelDateToISO(45153), rating: starsToNumber("★★★★½") },
  { title: "Achados e Perdidos",                                 author: "Stephen King",      category: "Suspense", pages: 352,  year: 2023, status: "finished", start_date: excelDateToISO(45152), end_date: excelDateToISO(45157), rating: starsToNumber("★★★★★") },
  { title: "Último Turno",                                       author: "Stephen King",      category: "Suspense", pages: 344,  year: 2023, status: "finished", start_date: excelDateToISO(45157), end_date: excelDateToISO(45163), rating: starsToNumber("★★★★★") },
  { title: "Frankenstein",                                       author: "Mary Shelley",      category: "HQ",       pages: 97,   year: 2023, status: "finished", start_date: excelDateToISO(45164), end_date: excelDateToISO(45164), rating: starsToNumber("★★★★★") },
  { title: "O Médico e o Monstro",                               author: "Daniel Esteves",    category: "HQ",       pages: 96,   year: 2023, status: "finished", start_date: excelDateToISO(45166), end_date: excelDateToISO(45166), rating: starsToNumber("★★★★★") },
  { title: "Billy Summers",                                      author: "Stephen King",      category: "Suspense", pages: 472,  year: 2023, status: "finished", start_date: excelDateToISO(45170), end_date: excelDateToISO(45178), rating: starsToNumber("★★★★★") },
  { title: "O Morro dos Ventos Uivantes",                        author: "Emily Brontë",      category: "HQ",       pages: 97,   year: 2023, status: "finished", start_date: excelDateToISO(45179), end_date: excelDateToISO(45179), rating: starsToNumber("★★★★½") },
  { title: "Cotoco e o Ovo de Codorna",                          author: "Michel V.P",        category: "HQ",       pages: 48,   year: 2023, status: "finished", start_date: excelDateToISO(45179), end_date: excelDateToISO(45179), rating: starsToNumber("★★★★½") },
  { title: "Catacumba: Antiquário dos Horrores",                 author: "Kikomics",          category: "HQ",       pages: 48,   year: 2023, status: "finished", start_date: excelDateToISO(45179), end_date: excelDateToISO(45179), rating: starsToNumber("★★★★★") },
  { title: "Holly",                                              author: "Stephen King",      category: "Suspense", pages: 448,  year: 2023, status: "finished", start_date: excelDateToISO(45180), end_date: excelDateToISO(45190), rating: starsToNumber("★★★★★") },
  { title: "O Que Aconteceu Com Annie",                          author: "CJ Tudor",          category: "Suspense", pages: 290,  year: 2023, status: "finished", start_date: excelDateToISO(45192), end_date: excelDateToISO(45205), rating: starsToNumber("★★★½") },
  { title: "Auguste Dupin, O Primeiro Detetive",                 author: "Edgar Allan Poe",   category: "Mistério", pages: 256,  year: 2023, status: "finished", start_date: excelDateToISO(45206), end_date: excelDateToISO(45225), rating: starsToNumber("★★★★½") },
  { title: "Como Lidar com Seus Fantasmas",                      author: "Lark",              category: "HQ",       pages: 100,  year: 2023, status: "finished", start_date: excelDateToISO(45234), end_date: excelDateToISO(45234), rating: starsToNumber("★★★★½") },
  { title: "Animais Fantásticos e Onde Habitam. O Roteiro Original", author: "J.K. Rowling", category: "Ficção",   pages: 298,  year: 2023, status: "finished", start_date: excelDateToISO(45246), end_date: excelDateToISO(45260), rating: starsToNumber("★★★★★") },
  { title: "Como Abraçar Um Fantasma",                           author: "Lark",              category: "HQ",       pages: 135,  year: 2023, status: "finished", start_date: excelDateToISO(45263), end_date: excelDateToISO(45263), rating: starsToNumber("★★★★½") },

  // ── 2025 ──
  { title: "Christine",                author: "Stephen King",  category: "Suspense", pages: 616, year: 2025, status: "finished", start_date: excelDateToISO(45658), end_date: excelDateToISO(45662), rating: starsToNumber("★★★★★") },
  { title: "FNAF: Olhos Prateados",    author: "Scott Cawthon", category: "Terror",   pages: 368, year: 2025, status: "finished", start_date: excelDateToISO(45663), end_date: excelDateToISO(45671), rating: starsToNumber("★★★★★") },
  { title: "Tripulação de Esqueletos", author: "Stephen King",  category: "Suspense", pages: 624, year: 2025, status: "finished", start_date: excelDateToISO(45677), end_date: excelDateToISO(45725), rating: starsToNumber("★★★★½") },
  { title: "FNAF: Os Distorcidos",     author: "Scott Cawthon", category: "Terror",   pages: 288, year: 2025, status: "finished", start_date: excelDateToISO(45726), end_date: excelDateToISO(45734), rating: starsToNumber("★★★★½") },
  { title: "Frankenstein",             author: "Mary Shelley",  category: "HQ",       pages: 97,  year: 2025, status: "finished", start_date: excelDateToISO(45775), end_date: excelDateToISO(45777), rating: starsToNumber("★★★★★") },
  { title: "Conto de Fadas",           author: "Stephen King",  category: "Fantasia", pages: 624, year: 2025, status: "finished", start_date: excelDateToISO(45890), end_date: excelDateToISO(45912), rating: starsToNumber("★★★★★") },
  { title: "Escuridão Total Sem Estrelas", author: "Stephen King", category: "Suspense", pages: 392, year: 2025, status: "finished", start_date: excelDateToISO(45922), end_date: excelDateToISO(45981), rating: starsToNumber("★★★★★") },
  { title: "Muda de Chá",              author: "Larkness",      category: "HQ",       pages: 224, year: 2025, status: "finished", start_date: excelDateToISO(45971), end_date: excelDateToISO(45971), rating: starsToNumber("★★★★★") },
  { title: "FNAF: A Última Porta",     author: "Scott Cawthon", category: "Terror",   pages: 336, year: 2025, status: "finished", start_date: excelDateToISO(46005), end_date: excelDateToISO(46010), rating: starsToNumber("★★★★") },
  { title: "Não Pisque",               author: "Stephen King",  category: "Suspense", pages: 448, year: 2025, status: "finished", start_date: excelDateToISO(46011), end_date: excelDateToISO(46022), rating: starsToNumber("★★★★★") },

  // ── 2026 ──
  { title: "O Iluminado",              author: "Stephen King",  category: "Terror",   pages: 520, year: 2026, status: "finished", start_date: excelDateToISO(46023), end_date: excelDateToISO(46034), rating: starsToNumber("★★★★★") },
  { title: "Doutor Sono",              author: "Stephen King",  category: "Terror",   pages: 480, year: 2026, status: "finished", start_date: excelDateToISO(46034), end_date: excelDateToISO(46044), rating: starsToNumber("★★★★★") },
  { title: "Um Corpo na Biblioteca",   author: "Agatha Christie", category: "Mistério", pages: 194, year: 2026, status: "finished", start_date: excelDateToISO(46045), end_date: excelDateToISO(46050), rating: starsToNumber("★★★★") },
  { title: "Mr. Mercedes",             author: "Stephen King",  category: "Suspense", pages: 398, year: 2026, status: "finished", start_date: excelDateToISO(46051), end_date: excelDateToISO(46061), rating: starsToNumber("★★★★★") },
  { title: "Guerra Civil",             author: "Stuart Moore",  category: "Ação",     pages: 398, year: 2026, status: "finished", start_date: excelDateToISO(46062), end_date: excelDateToISO(46068), rating: starsToNumber("★★★★★") },
  { title: "Mais Sombrio",             author: "Stephen King",  category: "Terror",   pages: 528, year: 2026, status: "finished", start_date: excelDateToISO(46072), end_date: excelDateToISO(46086), rating: starsToNumber("★★★★") },
  { title: "Achados e Perdidos",       author: "Stephen King",  category: "Suspense", pages: 352, year: 2026, status: "finished", start_date: excelDateToISO(46090), end_date: excelDateToISO(46103), rating: starsToNumber("★★★★★") },
  { title: "Tripulação de Esqueletos", author: "Stephen King",  category: "Suspense", pages: 624, year: 2026, status: "finished", start_date: excelDateToISO(46104), end_date: excelDateToISO(46141), rating: starsToNumber("★★★★★") },
  { title: "A Revolução dos Bichos",   author: "George Orwell", category: "Ficção",   pages: 192, year: 2026, status: "reading",  start_date: excelDateToISO(46146), end_date: null,                 rating: 0 },
];

// Insere tudo em uma transação (atômico — ou tudo vai ou nada vai)
const insertAll = db.transaction((list) => {
  for (const book of list) {
    insert.run(book);
  }
});

insertAll(books);

console.log(`✅ Migração concluída! ${books.length} livros inseridos.`);
db.close();