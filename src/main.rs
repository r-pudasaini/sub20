use std::path::Path;
use rocket::{fs::{FileServer, NamedFile}, http::{Cookie, CookieJar, SameSite}};
use rand::{thread_rng, Rng};

#[macro_use] extern crate rocket;


#[catch(404)]
async fn general_not_found() -> Option<NamedFile> {
    NamedFile::open(Path::new("../webapp/index.html")).await.ok()
    // disiplay the 404 not found page from the client side. 
}

#[get("/start-game", rank = 3)]
async fn start_game_route() -> Option<NamedFile> {
    // this is a client route that needs to be handled by the browser. 
    // we want to make sure the client does not get a 404 code, so we register this as a server route. 
    NamedFile::open(Path::new("../webapp/index.html")).await.ok()
}


#[get("/cookie", rank = 2)]
fn give_cookie(jar: &CookieJar<'_>) {

    let mut rng = thread_rng();
    let k : u16 = rng.gen();
    let v : u16 = rng.gen();

    let cookie = Cookie::build((format!("key: {}", k), format!("value: {}", v)))
        .path("/public/cookie")
        .same_site(SameSite::Strict);

    jar.add(cookie);
}

#[launch]
fn rocket() -> _ {
    rocket::build()
    .register("/", catchers![general_not_found])
    .mount("/public", routes![give_cookie])
    .mount("/", FileServer::from("../webapp"))
    .mount("/", routes![start_game_route])
}
