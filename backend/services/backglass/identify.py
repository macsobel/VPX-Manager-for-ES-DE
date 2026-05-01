#!/usr/bin/env python3
import pygame
import sys
import time

def identify_screen(display_index):
    pygame.init()
    
    num_displays = pygame.display.get_num_displays()
    if display_index >= num_displays:
        return

    try:
        # Create a window on the specific display
        # We use a non-fullscreen window as the user preferred
        screen = pygame.display.set_mode((400, 400), pygame.NOFRAME, display=display_index)
        screen.fill((20, 20, 25))
        
        # Draw a border
        pygame.draw.rect(screen, (79, 140, 255), (0, 0, 400, 400), 10)
        
        # Draw the number
        font = pygame.font.SysFont("Arial", 200, bold=True)
        text = font.render(str(display_index), True, (255, 255, 255))
        text_rect = text.get_rect(center=(200, 200))
        screen.blit(text, text_rect)
        
        # Label
        label_font = pygame.font.SysFont("Arial", 24)
        label = label_font.render(f"Display Index: {display_index}", True, (79, 140, 255))
        screen.blit(label, (20, 20))
        
        pygame.display.flip()

        # Hold for 5 seconds
        start_time = time.time()
        while time.time() - start_time < 5:
            for event in pygame.event.get():
                if event.type == pygame.QUIT or event.type == pygame.KEYDOWN:
                    return
            time.sleep(0.1)
            
    except Exception as e:
        print(f"Error on screen {display_index}: {e}")
    finally:
        pygame.quit()

if __name__ == "__main__":
    idx = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    identify_screen(idx)
