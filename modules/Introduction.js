import gsap, { SplitText } from "/scripts/greensock/esm/all.js";
import IntroduceDialog from './IntroduceDialog.js';
import { getActorIntroductionColors } from './ColorSettings.js';
import { RequestType } from './SocketHandler.js';

export default class Introduction {
    constructor() {
      if (!Introduction._instance) {
        Introduction._instance = this;
      }

      return Introduction._instance;
    }

    introduceMe = async (token) => {
        if(game.user.isGM && token) {
            await game.socket.emit(`module.introduce-me`, { type: RequestType.introduce, data: { uuid: token.document?.uuid ?? token.uuid } });
            await this.introductionDisplay(token, token.actor);
        }
    }

    introductionDisplay = async (token, actor, preview, overrideFlavor, overrideDuration) => {
        if(token){
            if(!preview && game.user.isGM){
                const usePermission = await game.settings.get('introduce-me', 'use-introduce-permission');
                const permissionUpdate = usePermission ? {
                    'permission': {
                        ...actor.data.permission,
                        default: actor.data.permission.default > 1 ? actor.data.permission.default : 1, 
                    }
                } : {};

                await actor.update({'token.displayName': 30, ...permissionUpdate});
                const scenes = Array.from(game.scenes);
                for(let i = 0; i < scenes.length; i++){
                    const tokens = Array.from(scenes[i].tokens);
                    for(let j = 0; j < tokens.length; j++){
                        const token = tokens[j];
                        if(token.actorId ?? token.data.actorId === actor.id){
                            await token.update({displayName: 30});
                        }
                    }
                }   
            }

            let sound = null;

            game.socket.on(`module.introduce-me`, request => {
                if(request.type === RequestType.close){
                        this.manualClose(node);
                }
            });

            const defaultIntroductionDuration = game.settings.get('introduce-me', 'introduction-duration');
            const actorIntroductionDuration = actor.getFlag('introduce-me', 'introduction-duration');
            const introductionDuration = overrideDuration ? overrideDuration : actorIntroductionDuration !== undefined ? actorIntroductionDuration : defaultIntroductionDuration;

            cleanupDOM();
            const useActorName = game.settings.get('introduce-me', 'use-actor-name');
            const flavor = this.flavorParse(overrideFlavor ?? await actor.getFlag('introduce-me', 'flavor') ?? String.fromCharCode(parseInt("00A0", 16)), actor);
            const colors = getActorIntroductionColors(token, actor);

            if(colors.audio?.sounds.length > 0){
                sound = await AudioHelper.play(colors.audio.sounds[0], false);
            }

            $(document.body).append($(await renderTemplate('modules/introduce-me/templates/introduction.hbs', { 
                name: useActorName ? actor.name : token.name, 
                img: this.getIntroductionImage(token, actor), 
                flavor: flavor,
                colors: colors,
                showSettings: !game.user.isGM || introductionDuration > 0 ? undefined : 1,
            })));

            const node = $(document.body).find('.introduce-me.introduction');
            this.setIntroductionPosition(node);

            const container = $(node).find('.introduction-container');
            const settings = $(node).find('.settings-ui');
            const image = $(container).find('img#actorImage');
            const label = $(container).find('label#name');
            const citation = $(container).find('label#citation');
            const splitLabel = new SplitText(label, {type:"words,chars"});
            const splitCitation = new SplitText(citation, {type:"words,chars"});

            const animationTimeline = gsap.timeline();
            animationTimeline
                .from(container, {width:0, height: 'auto', duration: 1})
                .to(image, {opacity: 1, duration: 1})
                .from(image, {left: -100, duration: 1}, "<+=0.2");

            if(splitLabel.chars.length > 0){
                animationTimeline
                    .to(label, {opacity: 1, duration: 0.2})
                    .from(splitLabel.chars, 0.8, {
                        opacity: 0, scale: 0, y: 80, rotationX: 180, transformOrigin: "0% 50% -50"
                    }, "<");
            }

            if(splitCitation.chars.length > 0){
                animationTimeline
                    .to(citation, {opacity: 1, duration: 0.2})
                    .from(splitCitation.chars, 0.8, {
                        opacity: 0, scale: 0, y: 80, rotationX: 180, transformOrigin: "0% 50% -50"
                    }, "<");
            }      
            
            if(settings.length === 1) {
                animationTimeline
                    .from(settings, {opacity:0, duration: 0.5}, '>');
            }

            if(introductionDuration > 0){
                animationTimeline.to(node, { opacity: 0, duration: 0.5 }, `>${introductionDuration}`);
                if(introductionDuration )
                setTimeout(() => {
                    sound?.fade(0, { duration: 2000 });
                }, 4000 + Math.max(introductionDuration-2000, 0));
                setTimeout(() => {
                    sound?.stop();
                    $(node).remove();
                }, 4000+(introductionDuration*1000));
            }

            $(node).find('.close-button').click(async event => {
                await game.socket.emit(`module.introduce-me`, { type: RequestType.close });
                this.manualClose(node, sound);
            });

        }
    }

    manualClose = (node, sound) => {
        gsap.to(node, { opacity: 0, duration: 0.5 });
        sound?.fade(0, { duration: 2000 });
        setTimeout(() => {
            sound?.stop();
            $(node).remove();
        }, 2000);
    };

    editDisplay = async (colors, localToken, localActor) => {
        cleanupDOM();
        const useActorName = game.settings.get('introduce-me', 'use-actor-name');
        const flavor = this.flavorParse(localActor?.getFlag('introduce-me', 'flavor') ?? game.i18n.localize("introduceMe.introduceDialog.flavorTitle"), localActor);
        let sound = null;

        if(colors.audio?.sounds.length > 0){
            sound = await AudioHelper.play(colors.audio.sounds[0], false);
        }

        $(document.body).append($(await renderTemplate('modules/introduce-me/templates/introduction.hbs', { 
            name: localToken ? (useActorName ? localActor.name : localToken.name) : game.i18n.localize("introduceMe.colorSettings.tester"), 
            img: localActor ? this.getIntroductionImage(localToken, localActor) : 'icons/svg/cowled.svg', 
            flavor: flavor,
            colors: colors,
            editing: true,
            showSettings: 1,
        })));

        this.setIntroductionPosition($(document.body).find('.introduce-me.introduction'));

        $(document.body).find('.close-button').click(event => {
            sound?.stop();
            $(document.body).find('.introduce-me.introduction').remove();
        });
    };

    introduceMeDialog = async (token) => {
        if(game.user.isGM && token){
            await new IntroduceDialog(token, token.actor).render(true);
        }
    }

    renderHUD = async (data, html) => {
        const rightColumn = $(html).find('.col.right');
        $(rightColumn).append(await renderTemplate('modules/introduce-me/templates/introductionInteract.hbs'));

        $(rightColumn).find('.introduce-me.introduction-interact').click(async () => {
            this.introduceMe(data.object);
            data.clear();
        });
    }

    getIntroductionImage = (token, actor) => {
        const useToken = game.settings.get('introduce-me', 'use-token');
        return useToken ? token.img ?? token.data.img : actor.img;
    }

    flavorParse = (flavor, actor) => {
        return Roll.replaceFormulaData(flavor, actor?.data?.data) ?? flavor;
    }
    
    setIntroductionPosition = (node) => {
        const { left, top, width, scale } = game.settings.get('introduce-me', 'position');
        node[0].style.left = `${left}px`;
        node[0].style.top = `${top}px`;
        node[0].style.width = `${width}px`;
        node[0].style.transform = `scale(${scale})`;
    }
}

export const cleanupDOM =() => {
    const bannerSettings = $(document.body).find('.introduce-me.banner-settings');
    const introduction = $(document.body).find('.introduce-me.introduction');
    if(bannerSettings.length > 0) {
        $(bannerSettings).remove();
    }
    else if(introduction.length > 0) {
        $(introduction).remove();
    }
}